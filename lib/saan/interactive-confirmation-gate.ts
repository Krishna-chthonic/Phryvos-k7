/**
 * Interactive Confirmation Gate & Sandboxed Execution Adapter (K7)
 * Clean-room adaptation of openinterpreter/open-interpreter architecture (Commit ac1fcc8, Apache-2.0).
 *
 * Implements:
 * 1. AskForApproval & CommandExecutionApprovalDecision types.
 * 2. Interactive approval card generator for Tier 2/3 operations.
 * 3. Conversational error formatter translating terminal/runtime errors into gentle Hinglish.
 * 4. Sandbox mode policies (read-only, workspace-write, unrestricted).
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

export interface FormattedConversationalError {
  errorType: "syntax" | "permission" | "timeout" | "missing_dependency" | "general";
  technicalMessage: string;
  conversationalHinglish: string;
  recoverySuggestion: string;
}

export class InteractiveGateManager {
  private pendingApprovals: Map<string, ApprovalCard> = new Map();
  private sessionAuthorizations: Set<string> = new Set(); // commands approved for session

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
      securityTier: options?.securityTier || 2,
      riskSummary,
      requiredPermissions: options?.requiredPermissions || ["process.exec"],
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };

    this.pendingApprovals.set(id, card);
    return card;
  }

  /**
   * Resolve an approval request with user's decision.
   */
  public resolveApproval(
    cardId: string,
    decision: CommandExecutionApprovalDecision
  ): { approved: boolean; card: ApprovalCard } {
    const card = this.pendingApprovals.get(cardId);
    if (!card) {
      throw new Error(`Approval card ${cardId} not found or expired`);
    }

    card.decision = decision;

    if (decision === "accept") {
      this.pendingApprovals.delete(cardId);
      return { approved: true, card };
    }

    if (decision === "acceptForSession") {
      this.sessionAuthorizations.add(card.command);
      this.pendingApprovals.delete(cardId);
      return { approved: true, card };
    }

    // decline / cancel
    this.pendingApprovals.delete(cardId);
    return { approved: false, card };
  }

  /**
   * Check if a command is pre-authorized for this session.
   */
  public isSessionAuthorized(command: string): boolean {
    return this.sessionAuthorizations.has(command);
  }

  /**
   * Heuristic risk assessor based on command tokens.
   */
  private assessRisk(command: string, tier: 1 | 2 | 3): string {
    const lower = command.toLowerCase();
    if (lower.includes("rm -rf") || lower.includes("drop table") || lower.includes("format")) {
      return "High risk: Irreversible file deletion or schema destruction";
    }
    if (lower.includes("curl") || lower.includes("wget") || lower.includes("git push")) {
      return "Medium risk: External network communication or remote mutation";
    }
    if (tier === 3) {
      return "Tier 3: Destructive mutation requires explicit confirmation";
    }
    return "Tier 2: Standard isolated execution with rollback capability";
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
  }
}
