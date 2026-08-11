import express from "express";
import { DOC_STAGES, FIXED_STAGE_MODES } from "../src/types";
import type { DealerDocument, DocStage, DocMode, Enquiry } from "../src/types";
import { canAdvance } from "../src/lib/docValidator";

/** Everything the document routes need from the server module. */
export type DocumentRoutesDeps = {
  readState: () => any;
  writeState: (state: any) => void;
  scopeToAgency: <T extends { agencyId?: string }>(rows: T[], auth: any) => T[];
  mayTouch: (row: { agencyId?: string } | undefined, auth: any) => boolean;
  newId: (prefix: string) => string;
};

/** Re-derive a lead's stage pointer from the documents that actually exist.
 *
 *  `docStage` is otherwise only ever advanced, so voiding a document part-way
 *  through a finished flow would leave the lead claiming a stage it no longer
 *  has evidence for. Deriving the next-due stage from signed documents makes
 *  the pointer self-correcting instead of something that can silently drift. */
export function recomputeDocStage(state: any, lead: any): void {
  if (!lead) return;
  const signed = new Set(
    ((state.documents || []) as any[])
      .filter((d) => d.leadId === lead.id && d.status === "Signed" && d.stage)
      .map((d) => d.stage),
  );
  const nextDue = DOC_STAGES.find((s) => !signed.has(s)) ?? null;
  lead.docStage = nextDue;
  if (nextDue === null) {
    if (!lead.docFlowCompletedAt) lead.docFlowCompletedAt = new Date().toISOString();
  } else {
    // No longer complete — the flow has a gap in it again.
    delete lead.docFlowCompletedAt;
  }
}

/** Agency Documents API — agency uploads its own files (any doc type/template)
 *  and captures a signature on them. No fixed template: whatever the agency needs. */
export function documentRoutes(deps: DocumentRoutesDeps): express.Router {
  const router = express.Router();
  const { readState, writeState, scopeToAgency, mayTouch, newId } = deps;

  router.get("/api/documents", (req: any, res) => {
    const state = readState();
    res.json(scopeToAgency(state.documents || [], req.auth));
  });

  router.post("/api/documents", (req: any, res) => {
    const state = readState();
    const {
      fileName,
      mimeType,
      fileData,
      leadId,
      propertyId,
      stage,
      mode,
      fieldSnapshot,
    } = req.body || {};
    // Take the agency from the session, not the request. Untagged documents
    // fall to the default agency, so a agency's own uploads disappeared from
    // their list the moment scoping was switched on.
    const agencyId =
      req.auth?.role === "admin" ? req.body?.agencyId : req.auth?.agencyId;

    // DocHub path: a stage was named. Validate it, honour the agency's
    // configured mode for that stage, and allow the doc to exist as a Draft
    // even before a file has been attached. Non-DocHub uploads keep the
    // original strict "need a file up front" contract.
    const isDocHub = typeof stage === "string" && DOC_STAGES.includes(stage as DocStage);

    if (isDocHub) {
      const stageTyped = stage as DocStage;
      if (mode !== "generate" && mode !== "attach" && mode !== "confirm") {
        return res.status(400).json({ error: "mode must be 'generate', 'attach', or 'confirm' when stage is set" });
      }
      if (!leadId) {
        return res.status(400).json({ error: "leadId is required for DocHub documents" });
      }

      /* The lead must be the caller's own. `mayTouch` guards the DOCUMENT, which
         is created under the caller's agency and therefore always passes —
         it says nothing about the lead the document names. Finalising and voiding
         both write `docStage`, `docFlowCompletedAt` and `dealChecklist` onto that
         lead, so an unchecked id here let one agency advance another agency's
         deal. 404 rather than 403: the caller should not learn whether an id
         exists elsewhere.

         Admins may act for any agency, and often send no agencyId, so the
         document takes the lead's — a document and the deal it belongs to must
         never end up under different tenants. */
      const ownerLead = state.enquiries.find((l: any) => l.id === leadId);
      if (!ownerLead) return res.status(404).json({ error: "Enquiry not found" });
      if (req.auth?.role !== "admin" && ownerLead.agencyId !== agencyId) {
        return res.status(404).json({ error: "Enquiry not found" });
      }
      const docAgencyId = ownerLead.agencyId ?? agencyId;
      // Fixed-mode stages (compliance = confirm) cannot be overridden by any
      // caller. Non-fixed stages must match the agency's configured mode; admins
      // can cross the line for support work.
      const fixedMode = FIXED_STAGE_MODES[stageTyped];
      if (fixedMode && mode !== fixedMode) {
        return res.status(400).json({
          error: `Stage '${stageTyped}' is fixed at '${fixedMode}' mode.`,
        });
      }
      if (!fixedMode && req.auth?.role !== "admin") {
        const agency = (state.agencies || []).find((d: any) => d.id === docAgencyId);
        const configured = agency?.docFlow?.[stageTyped] || "attach";
        if (configured !== (mode as DocMode)) {
          return res.status(400).json({
            error: `Agency's ${stageTyped} stage is set to '${configured}', not '${mode}'. Change it in Doc Flow Settings first.`,
          });
        }
      }
      // Attach mode: a file is what the whole point is. Reject without one.
      // Generate mode: v1 defers PDF rendering, so no file is required yet.
      // Confirm mode: no file at all — this stage is verified by checklist flags.
      if (mode === "attach" && !fileData) {
        return res.status(400).json({ error: "fileData is required for attach mode" });
      }

      // Auto-populate propertyId from the lead if the caller didn't pass one, so
      // the doc surfaces on the property record without every client having to
      // remember the linkage.
      const lead = (state.enquiries || []).find((l: any) => l.id === leadId);
      const resolvedVehicleId = propertyId || lead?.propertyId || undefined;

      const newDoc: DealerDocument = {
        id: newId("doc_"),
        fileName: fileName || `${stageTyped}-${new Date().toISOString().slice(0, 10)}`,
        mimeType: mimeType || "application/pdf",
        fileData: fileData || "",
        status: "Draft",
        uploadedAt: new Date().toISOString(),
        leadId,
        propertyId: resolvedVehicleId,
        agencyId: docAgencyId,
        stage: stageTyped,
        mode: mode as DocMode,
        fieldSnapshot: mode === "generate" ? (fieldSnapshot || {}) : undefined,
      };
      if (!state.documents) state.documents = [];
      state.documents.unshift(newDoc);
      if (!state.docEvents) state.docEvents = [];
      state.docEvents.unshift({
        id: newId("de_"),
        docId: newDoc.id,
        leadId,
        action: "created",
        userId: req.auth?.userId,
        timestamp: new Date().toISOString(),
        // Follows the document, so the audit row is scoped with what it describes.
        agencyId: docAgencyId,
      });
      writeState(state);
      return res.status(201).json({ message: "Document created.", document: newDoc });
    }

    // Legacy hub upload path — unchanged.
    if (!fileName || !fileData) {
      return res.status(400).json({ error: "fileName and fileData are required" });
    }
    const newDoc: DealerDocument = {
      id: newId("doc_"),
      fileName,
      mimeType: mimeType || "application/octet-stream",
      fileData,
      status: "Unsigned",
      uploadedAt: new Date().toISOString(),
      leadId: leadId || undefined,
      propertyId: propertyId || undefined,
      agencyId,
    };
    if (!state.documents) state.documents = [];
    state.documents.unshift(newDoc);
    writeState(state);
    res.status(201).json({ message: "Document uploaded.", document: newDoc });
  });

  router.post("/api/documents/:id/sign", (req: any, res) => {
    const state = readState();
    const index = (state.documents || []).findIndex((d: any) => d.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Document not found" });
    }
    if (!mayTouch(state.documents[index], req.auth)) {
      return res.status(403).json({ error: "Not your document." });
    }
    const { signature, signedBy } = req.body || {};
    if (!signature) {
      return res.status(400).json({ error: "signature is required" });
    }
    state.documents[index] = {
      ...state.documents[index],
      status: "Signed",
      signature,
      signedBy: signedBy || "Signee",
      signedAt: new Date().toISOString(),
    };
    writeState(state);
    res.json({ message: "Document signed.", document: state.documents[index] });
  });

  router.delete("/api/documents/:id", (req: any, res) => {
    const state = readState();
    const target = (state.documents || []).find((d: any) => d.id === req.params.id);
    if (!target) return res.status(404).json({ error: "Document not found" });
    if (!mayTouch(target, req.auth)) {
      return res.status(403).json({ error: "Not your document." });
    }

    /* A signed stage document is the evidence a stage was completed. Deleting it
       would leave the lead advanced past a stage with nothing behind it, and
       destroy the audit trail for a contract the customer signed. Void it
       instead: the record survives, marked invalid, and the stage reopens. */
    if (target.stage && target.status === "Signed") {
      return res.status(409).json({
        error: "This document is signed evidence for a completed stage — void it instead of deleting it.",
        stage: target.stage,
      });
    }

    state.documents = (state.documents || []).filter((d: any) => d.id !== req.params.id);
    // Its audit rows go with it — otherwise they are served forever pointing at
    // a document id that no longer resolves.
    state.docEvents = ((state.docEvents || []) as any[]).filter((e) => e.docId !== target.id);
    writeState(state);
    res.json({ message: "Document deleted." });
  });

  /** Void a signed stage document: keep the record, mark it invalid, and reopen
   *  the stage. The counterpart to refusing deletion above. */
  router.post("/api/documents/:id/void", (req: any, res) => {
    const state = readState();
    const index = (state.documents || []).findIndex((d: any) => d.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Document not found" });
    const doc = state.documents[index] as any;
    if (!mayTouch(doc, req.auth)) return res.status(403).json({ error: "Not your document." });
    if (!doc.stage) {
      return res.status(400).json({ error: "Only a DocHub stage document can be voided." });
    }

    state.documents[index] = { ...doc, status: "Void" };

    if (!state.docEvents) state.docEvents = [];
    state.docEvents.unshift({
      id: newId("de_"),
      docId: doc.id,
      leadId: doc.leadId,
      action: "voided",
      userId: req.auth?.userId,
      timestamp: new Date().toISOString(),
      agencyId: doc.agencyId,
    });

    const lead = (state.enquiries || []).find((l: any) => l.id === doc.leadId);
    /* Finalising the invoice stage ticks `dealChecklist.invoiced`; voiding it has
       to untick, or the checklist keeps asserting an invoice that no longer
       exists. The drift report was reporting exactly this pair and nothing was
       repairing it. */
    if (doc.stage === "invoice" && lead?.dealChecklist?.invoiced) {
      lead.dealChecklist = { ...lead.dealChecklist, invoiced: false };
    }
    recomputeDocStage(state, lead);

    writeState(state);
    res.json({
      message: "Document voided.",
      document: state.documents[index],
      lead: lead ? { id: lead.id, docStage: lead.docStage, docFlowCompletedAt: lead.docFlowCompletedAt } : null,
    });
  });

  /** Per-stage mode configuration. Agencys self-serve for their own agency;
   *  admins may target any agency by passing `agencyId` in the body. */
  router.put("/api/docflow", (req: any, res) => {
    const state = readState();
    const targetId =
      req.auth?.role === "admin" ? (req.body?.agencyId || req.auth?.agencyId) : req.auth?.agencyId;
    if (!targetId) return res.status(400).json({ error: "agencyId required" });
    const i = (state.agencies || []).findIndex((d: any) => d.id === targetId);
    if (i === -1) return res.status(404).json({ error: "Agency not found" });

    const { docFlow } = req.body || {};
    if (!docFlow || typeof docFlow !== "object") {
      return res.status(400).json({ error: "docFlow object required" });
    }
    const clean: Partial<Record<DocStage, DocMode>> = {};
    for (const stage of DOC_STAGES) {
      const mode = docFlow[stage];
      if (mode === "generate" || mode === "attach") clean[stage] = mode;
    }
    state.agencies[i].docFlow = { ...(state.agencies[i].docFlow || {}), ...clean };
    writeState(state);
    res.json({ agency: state.agencies[i] });
  });

  /** Docs for a specific deal (lead). Scoped to the caller's agency. */
  router.get("/api/deals/:leadId/documents", (req: any, res) => {
    const state = readState();
    const all = (state.documents || []).filter((d: any) => d.leadId === req.params.leadId);
    res.json(scopeToAgency(all, req.auth));
  });

  /** Finalise a DocHub document — runs the validator (generate mode only),
   *  marks the doc signed, appends an audit event, and advances the parent
   *  lead's docStage to the next stage in DOC_STAGES. Also flips the existing
   *  dealChecklist.invoiced flag when the invoice stage completes so the older
   *  readiness view stays in step with DocHub. */
  router.post("/api/documents/:id/finalize", (req: any, res) => {
    const state = readState();
    const index = (state.documents || []).findIndex((d: any) => d.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Document not found" });
    const doc = state.documents[index];
    if (!mayTouch(doc, req.auth)) return res.status(403).json({ error: "Not your document." });
    if (!doc.stage || !doc.mode) {
      return res.status(400).json({ error: "This document is not a DocHub stage document." });
    }

    const lead = (state.enquiries || []).find((l: any) => l.id === doc.leadId) as Enquiry | undefined;

    /* Stages run in order, and finalising one asserts the ones before it are
       done. Without this, a lone handover document could be finalised on an
       untouched deal: `currentIdx` is -1, `thisIdx >= currentIdx` passes, the
       next stage resolves to null and the deal is stamped complete having
       produced no proforma, deed, compliance or invoice at all — then vanishes
       off Deal Readiness. */
    const signedStages = new Set(
      ((state.documents || []) as any[])
        .filter((d) => d.leadId === doc.leadId && d.status === "Signed" && d.stage)
        .map((d) => d.stage),
    );
    const missingEarlier = DOC_STAGES.slice(0, DOC_STAGES.indexOf(doc.stage)).filter(
      (s) => !signedStages.has(s),
    );
    if (missingEarlier.length > 0) {
      return res.status(422).json({
        error: "Earlier stages are not finalised yet.",
        missing: missingEarlier,
      });
    }

    if (doc.mode === "generate") {
      const check = canAdvance(doc.stage, doc.fieldSnapshot || {}, lead);
      if (!check.ok) {
        return res.status(422).json({
          error: "Required fields are missing.",
          missing: check.missing,
        });
      }
    } else if (doc.mode === "confirm") {
      // Compliance uses this path: verify the checklist flags rather than a
      // file. Reject with the same shape as canAdvance so the client renders
      // the missing list without a special case.
      const missing: string[] = [];
      if (doc.stage === "compliance") {
        if (!lead?.dealChecklist?.electricalCoc) missing.push("electricalCoc");
        if (!lead?.dealChecklist?.beetleClearance) missing.push("beetleClearance");
      }
      if (missing.length > 0) {
        return res.status(422).json({ error: "Compliance not confirmed.", missing });
      }
    } else {
      // Attach mode: agency's own doc must be present and signed before we
      // treat the stage as complete. /api/documents/:id/sign is the existing
      // canvas-signature endpoint they'll have hit already.
      if (!doc.fileData) return res.status(422).json({ error: "No file attached." });
      if (doc.status !== "Signed") {
        return res.status(422).json({ error: "Attached document must be signed before finalising." });
      }
    }

    state.documents[index] = {
      ...doc,
      status: "Signed",
      signedAt: doc.signedAt || new Date().toISOString(),
    };

    if (!state.docEvents) state.docEvents = [];
    state.docEvents.unshift({
      id: newId("de_"),
      docId: doc.id,
      leadId: doc.leadId,
      action: "finalized",
      userId: req.auth?.userId,
      timestamp: new Date().toISOString(),
      agencyId: doc.agencyId,
    });

    // Advance the lead's stage. If already past this stage (e.g. agency went
    // back and re-finalised an earlier stage), leave the current position
    // alone rather than yanking them backwards.
    if (lead) {
      const currentIdx = lead.docStage ? DOC_STAGES.indexOf(lead.docStage) : -1;
      const thisIdx = DOC_STAGES.indexOf(doc.stage);
      if (thisIdx >= currentIdx) {
        const nextStage = DOC_STAGES[thisIdx + 1] ?? null;
        lead.docStage = nextStage;
        /* Finalising the last stage leaves docStage null — indistinguishable
           from a lead that never started. Stamp completion separately so the
           two can be told apart; without this a finished deal renders as if it
           were sitting at Proforma. */
        if (nextStage === null) {
          lead.docFlowCompletedAt = new Date().toISOString();
        }
      }
      // Keep the older readiness checklist consistent when the invoice stage
      // finalises — the two views must never disagree about "is this invoiced".
      if (doc.stage === "invoice") {
        lead.dealChecklist = { ...(lead.dealChecklist || {}), invoiced: true };
      }
    }

    writeState(state);
    res.json({
      message: "Document finalised.",
      document: state.documents[index],
      lead: lead
        ? { id: lead.id, docStage: lead.docStage, docFlowCompletedAt: lead.docFlowCompletedAt }
        : null,
    });
  });

  return router;
}
