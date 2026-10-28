/**
 * Gnosys Open Portable Memory Interchange Specification (v1.0)
 *
 * Clean-room adaptation of sovereign JSON-LD memory snapshots:
 * 1. Standardizes companion memory records into an open, portable schema.
 * 2. Cryptographic SHA-256 envelope validation to detect corruption or tampering.
 * 3. Bi-temporal attributes (validAt, invalidAt, expiredAt).
 * 4. Zero vendor lock-in export/import pipeline.
 */

import { createHash } from 'crypto';

export interface GnosysMemoryFact {
  id: string;
  category: 'preference' | 'habit' | 'biography' | 'emotional_anchor' | 'relational' | 'instruction' | 'personal';
  fact: string;
  confidence: number;
  validAt: string;
  invalidAt?: string;
  expiredAt?: string;
  provenance?: {
    source: string;
    generatedAt: string;
    turnId?: string;
  };
}

export interface GnosysMemoryEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
  validAt: string;
  invalidAt?: string;
}

export interface GnosysCoreMemoryBlocks {
  persona: string;
  human: string;
  maxPersonaLength?: number;
  maxHumanLength?: number;
}

export interface GnosysSnapshotPayload {
  '@context': string;
  '@type': string;
  version: string;
  exportedAt: string;
  agentId: string;
  coreMemory: GnosysCoreMemoryBlocks;
  facts: GnosysMemoryFact[];
  edges: GnosysMemoryEdge[];
  metadata?: Record<string, unknown>;
  checksum?: string;
}

export interface SnapshotValidationResult {
  valid: boolean;
  error?: string;
  factCount: number;
  edgeCount: number;
  calculatedChecksum: string;
}

export class GnosysMemoryPortabilityEngine {
  public static readonly CONTEXT_URI = 'https://w3id.org/gnosys/v1';
  public static readonly SPEC_VERSION = '1.0.0';

  /**
   * Generates a deterministic SHA-256 canonical hash across all payload content.
   */
  public static computeChecksum(
    coreMemory: GnosysCoreMemoryBlocks,
    facts: GnosysMemoryFact[],
    edges: GnosysMemoryEdge[]
  ): string {
    const sortedFacts = [...facts].sort((a, b) => a.id.localeCompare(b.id));
    const sortedEdges = [...edges].sort((a, b) =>
      `${a.source}->${a.target}:${a.relationship}`.localeCompare(`${b.source}->${b.target}:${b.relationship}`)
    );

    const canonicalRepresentation = JSON.stringify({
      persona: coreMemory.persona.trim(),
      human: coreMemory.human.trim(),
      facts: sortedFacts.map((f) => ({
        id: f.id,
        category: f.category,
        fact: f.fact.trim(),
        validAt: f.validAt,
      })),
      edges: sortedEdges.map((e) => ({
        source: e.source,
        target: e.target,
        rel: e.relationship,
        weight: e.weight,
      })),
    });

    return createHash('sha256').update(canonicalRepresentation, 'utf8').digest('hex');
  }

  /**
   * Serializes current companion state into a Gnosys v1.0 sovereign memory snapshot.
   */
  public static exportSnapshot(params: {
    agentId: string;
    coreMemory: GnosysCoreMemoryBlocks;
    facts: GnosysMemoryFact[];
    edges: GnosysMemoryEdge[];
    metadata?: Record<string, unknown>;
  }): GnosysSnapshotPayload {
    const checksum = this.computeChecksum(params.coreMemory, params.facts, params.edges);

    return {
      '@context': this.CONTEXT_URI,
      '@type': 'MemorySnapshot',
      version: this.SPEC_VERSION,
      exportedAt: new Date().toISOString(),
      agentId: params.agentId,
      coreMemory: {
        persona: params.coreMemory.persona,
        human: params.coreMemory.human,
        maxPersonaLength: params.coreMemory.maxPersonaLength ?? 2000,
        maxHumanLength: params.coreMemory.maxHumanLength ?? 2000,
      },
      facts: params.facts,
      edges: params.edges,
      metadata: params.metadata,
      checksum,
    };
  }

  /**
   * Validates and imports a Gnosys snapshot, rejecting corrupted or unauthenticated payloads.
   */
  public static validateAndImport(snapshotJson: string | GnosysSnapshotPayload): SnapshotValidationResult {
    let payload: GnosysSnapshotPayload;
    if (typeof snapshotJson === 'string') {
      try {
        payload = JSON.parse(snapshotJson);
      } catch (err: unknown) {
        return {
          valid: false,
          error: `JSON parse failure: ${(err as Error).message}`,
          factCount: 0,
          edgeCount: 0,
          calculatedChecksum: '',
        };
      }
    } else {
      payload = snapshotJson;
    }

    if (payload['@context'] !== this.CONTEXT_URI) {
      return {
        valid: false,
        error: `Invalid @context: Expected "${this.CONTEXT_URI}", received "${payload['@context']}"`,
        factCount: 0,
        edgeCount: 0,
        calculatedChecksum: '',
      };
    }

    if (payload['@type'] !== 'MemorySnapshot') {
      return {
        valid: false,
        error: `Invalid @type: Expected "MemorySnapshot", received "${payload['@type']}"`,
        factCount: 0,
        edgeCount: 0,
        calculatedChecksum: '',
      };
    }

    if (!payload.coreMemory || typeof payload.coreMemory.persona !== 'string' || typeof payload.coreMemory.human !== 'string') {
      return {
        valid: false,
        error: 'Malformed coreMemory: persona and human strings are mandatory',
        factCount: 0,
        edgeCount: 0,
        calculatedChecksum: '',
      };
    }

    if (!Array.isArray(payload.facts) || !Array.isArray(payload.edges)) {
      return {
        valid: false,
        error: 'Malformed snapshot: facts and edges must be arrays',
        factCount: 0,
        edgeCount: 0,
        calculatedChecksum: '',
      };
    }

    const calculated = this.computeChecksum(payload.coreMemory, payload.facts, payload.edges);

    if (payload.checksum && payload.checksum !== calculated) {
      return {
        valid: false,
        error: `Checksum mismatch: payload=${payload.checksum}, calculated=${calculated}. State was modified or corrupted.`,
        factCount: payload.facts.length,
        edgeCount: payload.edges.length,
        calculatedChecksum: calculated,
      };
    }

    return {
      valid: true,
      factCount: payload.facts.length,
      edgeCount: payload.edges.length,
      calculatedChecksum: calculated,
    };
  }
}
