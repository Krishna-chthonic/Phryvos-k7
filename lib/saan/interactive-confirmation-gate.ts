/**
 * Interactive Confirmation Gate & Sandboxed Execution Adapter (K7)
 * Clean-room adaptation of openinterpreter/open-interpreter & smolagents confirmation architecture.
 *
 * Implements:
 * 1. 3-tier security gate (Tier 1: Read-Only, Tier 2: Workspace Mutation, Tier 3: Critical Irreversible).
 * 2. AskForApproval & CommandExecutionApprovalDecision types.
 * 3. Cryptographic SHA-256 audit receipts for all resolved security decisions.
 * 4. Conversational error formatter translating terminal/runtime errors into gentle Hinglish.
 * 5. Sandbox mode policies (read-only, workspace-write, unrestricted).
 */

import crypto from "node:crypto";

export type SandboxMode = "read-only" | "workspace-write" | "unrestricted";

export type AskForApproval =
  | "untrusted"
  | "on-request"
  | {
      granular: {
        sandbox_approval: boolean;
        rules: boolean;
        skill_approval: boolean;
        request_permissions: boolean;
        mcp_elicitations: boolean;
      };
    }
  | "never";

export type CommandExecutionApprovalDecision =
  | "accept"
  | "acceptForSession"
  | { acceptWithExecpolicyAmendment: { amendment: string } }
  | { applyNetworkPolicyAmendment: { allowedHosts: string[] } }
  | "decline"
  | "cancel";

export interface ApprovalCard {
  id: string;
  command: string;
  workingDirectory: string;
  sandboxMode: SandboxMode;
  securityTier: 1 | 2 | 3;
  riskSummary: string;
  requiredPermissions: string[];
  decision?: CommandExecutionApprovalDecision;
  createdAt: string;
  expiresAt: string;
}

export interface GateAuditReceipt {
  id: string;
  cardId: string;
  command: string;
  decision: string;
  securityTier: 1 | 2 | 3;
  resolvedAt: string;
  sha256Hash: string;
}

export interface FormattedConversationalError {
  errorType: "syntax" | "permission" | "timeout" | "missing_dependency" | "general";
  technicalMessage: string;
  conversationalHinglish: string;
  recoverySuggestion: string;
}

export class InteractiveGateManager {
  private pendingApprovals: Map<string, ApprovalCard> = new Map();
  private sessionAuthorizations: Set<string> = new Set();
  private auditLedger: GateAuditReceipt[] = [];

  constructor() {
    this.seedDefaultSamples();
  }

  private seedDefaultSamples(): void {
    if (this.pendingApprovals.size === 0) {
      this.createApprovalCard("rm -rf /root/.saan/cache/old_scratch", {
        workingDirectory: "/root/.saan/cache",
        securityTier: 3,
        sandboxMode: "workspace-write",
        requiredPermissions: ["fs.write", "fs.delete"],
      });
      this.createApprovalCard("git push --force origin backup-staging", {
        workingDirectory: "/root/k7",
        securityTier: 2,
        sandboxMode: "unrestricted",
        requiredPermissions: ["network.egress", "process.exec"],
      });
    }
  }

  /**
   * Create an approval request card before executing high-impact commands.
   */
  public createApprovalCard(
    command: string,
    options?: {
      workingDirectory?: string;
      sandboxMode?: SandboxMode;
      securityTier?: 1 | 2 | 3;
      requiredPermissions?: string[];
      ttlSeconds?: number;
    }
  ): ApprovalCard {
    const id = `appr-${crypto.randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const ttlMs = (options?.ttlSeconds || 300) * 1000;

    const riskSummary = this.assessRisk(command, options?.securityTier || 2);

    const card: ApprovalCard = {
      id,
      command,
      workingDirectory: options?.workingDirectory || process.cwd(),
      sandboxMode: options?.sandboxMode || "workspace-write",
      securityTier: options?.securityTier || (command.includes("rm -rf") ? 3 : 2),
      riskSummary,
      requiredPermissions: options?.requiredPermissions || ["process.exec"],
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };

    this.pendingApprovals.set(id, card);
    return card;
  }

  /**
   * Retrieve list of all pending approvals that haven't expired.
   */
  public getPendingApprovals(): ApprovalCard[] {
    const now = Date.now();
    const active: ApprovalCard[] = [];
    for (const [id, card] of this.pendingApprovals.entries()) {
      if (new Date(card.expiresAt).getTime() < now) {
        this.pendingApprovals.delete(id);
      } else {
        active.push({ ...card });
      }
    }
    return active;
  }

  /**
   * Resolve an approval request with user's decision and record cryptographic audit receipt.
   */
  public resolveApproval(
    cardId: string,
    decision: CommandExecutionApprovalDecision
  ): { approved: boolean; card: ApprovalCard; receipt: GateAuditReceipt } {
    const card = this.pendingApprovals.get(cardId);
    if (!card) {
      throw new Error(`Approval card ${cardId} not found or expired`);
    }

    card.decision = decision;
    const resolvedAt = new Date().toISOString();
    const decisionStr = typeof decision === "string" ? decision : JSON.stringify(decision);

    // Cryptographic SHA-256 fingerprint of the authorization receipt
    const hash = crypto
      .createHash("sha256")
      .update(`${card.id}:${card.command}:${decisionStr}:${resolvedAt}`)
      .digest("hex");

    const receipt: GateAuditReceipt = {
      id: `rcpt-${crypto.randomUUID().slice(0, 8)}`,
      cardId: card.id,
      command: card.command,
      decision: decisionStr,
      securityTier: card.securityTier,
      resolvedAt,
      sha256Hash: hash,
    };

    this.auditLedger.unshift(receipt);
    if (this.auditLedger.length > 50) {
      this.auditLedger.pop();
    }

    if (decision === "accept") {
      this.pendingApprovals.delete(cardId);
      return { approved: true, card, receipt };
    }

    if (decision === "acceptForSession") {
      this.sessionAuthorizations.add(card.command);
      this.pendingApprovals.delete(cardId);
      return { approved: true, card, receipt };
    }

    // decline / cancel
    this.pendingApprovals.delete(cardId);
    return { approved: false, card, receipt };
  }

  /**
   * Retrieve audit history ledger.
   */
  public getAuditHistory(): GateAuditReceipt[] {
    return [...this.auditLedger];
  }

  /**
   * Check if a command is pre-authorized for this session.
   */
  public isSessionAuthorized(command: string): boolean {
    return this.sessionAuthorizations.has(command);
  }

  /**
   * Get list of session authorizations.
   */
  public getSessionAuthorizations(): string[] {
    return Array.from(this.sessionAuthorizations);
  }

  /**
   * Heuristic risk assessor based on command tokens.
   */
  public assessRisk(command: string, tier: 1 | 2 | 3): string {
    const lower = command.toLowerCase();
    if (lower.includes("rm -rf") || lower.includes("drop table") || lower.includes("format") || lower.includes("--force")) {
      return "High risk (Tier 3): Irreversible mutation, file deletion ya unrecoverable overwrite";
    }
    if (lower.includes("curl") || lower.includes("wget") || lower.includes("git push")) {
      return "Medium risk (Tier 2): External network communication ya remote repo update";
    }
    if (tier === 3) {
      return "Tier 3: Destructive mutation requires explicit confirmation";
    }
    if (tier === 1) {
      return "Tier 1: Read-only safe inspection";
    }
    return "Tier 2: Standard workspace isolated execution with rollback capability";
  }

  /**
   * Translates runtime and command errors into empathetic Hinglish.
   */
  public formatConversationalError(rawError: Error | string): FormattedConversationalError {
    const msg = typeof rawError === "string" ? rawError : rawError.message || String(rawError);
    const lower = msg.toLowerCase();

    if (lower.includes("syntaxerror") || lower.includes("unexpected token")) {
      return {
        errorType: "syntax",
        technicalMessage: msg,
        conversationalHinglish: "Command ke syntax mein thodi gadbad thi, isliye execution ruk gaya.",
        recoverySuggestion: "Arguments aur quotes dobara verify karke try karte hain.",
      };
    }

    if (lower.includes("eacces") || lower.includes("permission denied")) {
      return {
        errorType: "permission",
        technicalMessage: msg,
        conversationalHinglish: "Is resource ko access karne ki permission nahi mili.",
        recoverySuggestion: "Aap verify karein ki required file access ya elevated permission allow ki gayi hai.",
      };
    }

    if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("etimedout")) {
      return {
        errorType: "timeout",
        technicalMessage: msg,
        conversationalHinglish: "Command run hone mein zyada time lag gaya aur timeout ho gaya.",
        recoverySuggestion: "Network connection check karein ya timeout window increase karein.",
      };
    }

    if (lower.includes("not found") || lower.includes("cannot find module")) {
      return {
        errorType: "missing_dependency",
        technicalMessage: msg,
        conversationalHinglish: "Required file ya dependency system mein nahi mili.",
        recoverySuggestion: "Check karein ki package install hai aur path sahi specify kiya hai.",
      };
    }

    return {
      errorType: "general",
      technicalMessage: msg,
      conversationalHinglish: "Execution ke dauran ek unexpected issue aaya.",
      recoverySuggestion: "Log parameters inspect karke step retry kiya ja sakta hai.",
    };
  }

  public clearSession(): void {
    this.pendingApprovals.clear();
    this.sessionAuthorizations.clear();
    this.auditLedger = [];
  }
}
