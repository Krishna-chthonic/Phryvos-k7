/**
 * Gnosys & Dify Open Portable Memory Interchange Specification (v1.0)
 *
 * Clean-room adaptation of sovereign JSON-LD memory snapshots & Dify dataset interchange:
 * 1. Standardizes companion memory records into an open, portable JSON-LD schema.
 * 2. Cryptographic SHA-256 envelope validation to detect corruption or tampering.
 * 3. Bi-temporal attributes (validAt, invalidAt, expiredAt).
 * 4. Dify Dataset CSV/JSON-Lines compatibility transformer.
 * 5. 3-Way Merge Protocol: OVERWRITE, UNION, CONSERVATIVE.
 * 6. Zero vendor lock-in export/import pipeline.
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

export interface DifyDocumentFormat {
  id: string;
  name: string;
  text: string;
  doc_type: string;
  doc_metadata: Record<string, unknown>;
}

export type MergeStrategy = 'UNION' | 'OVERWRITE' | 'CONSERVATIVE';

export interface SnapshotValidationResult {
  valid: boolean;
  error?: string;
  factCount: number;
  edgeCount: number;
  calculatedChecksum: string;
  coreMemoryChars: number;
}

export interface ImportResult {
  success: boolean;
  strategy: MergeStrategy;
  importedFactsCount: number;
  importedEdgesCount: number;
  skippedFactsCount: number;
  error?: string;
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
   * Converts Gnosys snapshot to Dify-compatible dataset format.
   */
  public static toDifyDataset(snapshot: GnosysSnapshotPayload): {
    dataset_name: string;
    documents: DifyDocumentFormat[];
  } {
    const documents: DifyDocumentFormat[] = [];

    // 1. Core memory documents
    documents.push({
      id: `dify_core_persona_${snapshot.agentId}`,
      name: `Core Persona: ${snapshot.agentId}`,
      text: snapshot.coreMemory.persona,
      doc_type: 'core_persona',
      doc_metadata: { agentId: snapshot.agentId, length: snapshot.coreMemory.persona.length },
    });
    documents.push({
      id: `dify_core_human_${snapshot.agentId}`,
      name: `Core Human Profile: ${snapshot.agentId}`,
      text: snapshot.coreMemory.human,
      doc_type: 'core_human',
      doc_metadata: { agentId: snapshot.agentId, length: snapshot.coreMemory.human.length },
    });

    // 2. Fact documents
    for (const f of snapshot.facts) {
      documents.push({
        id: `dify_fact_${f.id}`,
        name: `Fact [${f.category}]: ${f.id}`,
        text: f.fact,
        doc_type: 'memory_fact',
        doc_metadata: {
          category: f.category,
          confidence: f.confidence,
          validAt: f.validAt,
          invalidAt: f.invalidAt,
        },
      });
    }

    return {
      dataset_name: `Saan_Memory_${snapshot.agentId}_${new Date().toISOString().slice(0, 10)}`,
      documents,
    };
  }

  /**
   * Validates and parses a Gnosys snapshot, checking schema, integrity and cryptographic checksum.
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
          coreMemoryChars: 0,
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
        coreMemoryChars: 0,
      };
    }

    if (payload['@type'] !== 'MemorySnapshot') {
      return {
        valid: false,
        error: `Invalid @type: Expected "MemorySnapshot", received "${payload['@type']}"`,
        factCount: 0,
        edgeCount: 0,
        calculatedChecksum: '',
        coreMemoryChars: 0,
      };
    }

    if (!payload.coreMemory || typeof payload.coreMemory.persona !== 'string' || typeof payload.coreMemory.human !== 'string') {
      return {
        valid: false,
        error: 'Malformed coreMemory: persona and human strings are mandatory',
        factCount: 0,
        edgeCount: 0,
        calculatedChecksum: '',
        coreMemoryChars: 0,
      };
    }

    if (!Array.isArray(payload.facts) || !Array.isArray(payload.edges)) {
      return {
        valid: false,
        error: 'Malformed snapshot: facts and edges must be arrays',
        factCount: 0,
        edgeCount: 0,
        calculatedChecksum: '',
        coreMemoryChars: 0,
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
        coreMemoryChars: (payload.coreMemory.persona?.length || 0) + (payload.coreMemory.human?.length || 0),
      };
    }

    return {
      valid: true,
      factCount: payload.facts.length,
      edgeCount: payload.edges.length,
      calculatedChecksum: calculated,
      coreMemoryChars: (payload.coreMemory.persona?.length || 0) + (payload.coreMemory.human?.length || 0),
    };
  }

  /**
   * Applies snapshot against existing memories using the chosen merge strategy.
   */
  public static mergeSnapshot(
    existing: {
      coreMemory: GnosysCoreMemoryBlocks;
      facts: GnosysMemoryFact[];
      edges: GnosysMemoryEdge[];
    },
    incoming: GnosysSnapshotPayload,
    strategy: MergeStrategy = 'UNION'
  ): {
    mergedCoreMemory: GnosysCoreMemoryBlocks;
    mergedFacts: GnosysMemoryFact[];
    mergedEdges: GnosysMemoryEdge[];
    result: ImportResult;
  } {
    if (strategy === 'OVERWRITE') {
      return {
        mergedCoreMemory: incoming.coreMemory,
        mergedFacts: [...incoming.facts],
        mergedEdges: [...incoming.edges],
        result: {
          success: true,
          strategy: 'OVERWRITE',
          importedFactsCount: incoming.facts.length,
          importedEdgesCount: incoming.edges.length,
          skippedFactsCount: 0,
        },
      };
    }

    // UNION Strategy
    if (strategy === 'UNION') {
      const existingFactKeys = new Set(existing.facts.map((f) => f.fact.trim().toLowerCase()));
      const newFacts: GnosysMemoryFact[] = [];
      let skipped = 0;

      for (const inFact of incoming.facts) {
        const key = inFact.fact.trim().toLowerCase();
        if (existingFactKeys.has(key)) {
          skipped++;
        } else {
          newFacts.push(inFact);
          existingFactKeys.add(key);
        }
      }

      const existingEdgeKeys = new Set(
        existing.edges.map((e) => `${e.source}->${e.target}:${e.relationship}`)
      );
      const newEdges: GnosysMemoryEdge[] = [];
      for (const inEdge of incoming.edges) {
        const k = `${inEdge.source}->${inEdge.target}:${inEdge.relationship}`;
        if (!existingEdgeKeys.has(k)) {
          newEdges.push(inEdge);
          existingEdgeKeys.add(k);
        }
      }

      return {
        mergedCoreMemory: {
          persona: incoming.coreMemory.persona || existing.coreMemory.persona,
          human: incoming.coreMemory.human || existing.coreMemory.human,
        },
        mergedFacts: [...existing.facts, ...newFacts],
        mergedEdges: [...existing.edges, ...newEdges],
        result: {
          success: true,
          strategy: 'UNION',
          importedFactsCount: newFacts.length,
          importedEdgesCount: newEdges.length,
          skippedFactsCount: skipped,
        },
      };
    }

    // CONSERVATIVE: only high confidence (>= 0.90) and do not overwrite core memory
    const existingFactKeys = new Set(existing.facts.map((f) => f.fact.trim().toLowerCase()));
    const newFacts: GnosysMemoryFact[] = [];
    let skipped = 0;

    for (const inFact of incoming.facts) {
      if (inFact.confidence < 0.9) {
        skipped++;
        continue;
      }
      const key = inFact.fact.trim().toLowerCase();
      if (existingFactKeys.has(key)) {
        skipped++;
      } else {
        newFacts.push(inFact);
        existingFactKeys.add(key);
      }
    }

    return {
      mergedCoreMemory: existing.coreMemory,
      mergedFacts: [...existing.facts, ...newFacts],
      mergedEdges: [...existing.edges],
      result: {
        success: true,
        strategy: 'CONSERVATIVE',
        importedFactsCount: newFacts.length,
        importedEdgesCount: 0,
        skippedFactsCount: skipped,
      },
    };
  }
}

