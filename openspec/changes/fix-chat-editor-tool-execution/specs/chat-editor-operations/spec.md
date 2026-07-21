## ADDED Requirements

### Requirement: Server declares chat tools without executing editor mutations

`/api/ai/chat` SHALL declare client-side editing tools with their descriptions and input schemas only. The server MUST NOT provide a placeholder or successful `execute` implementation for tools whose mutations require a browser editor instance.

#### Scenario: Client-side tool declaration

- **WHEN** the server builds the chat tool map for `insertBlock`, `updateBlock`, `deleteBlock`, `replaceBlocks`, `moveBlock`, or `replaceText`
- **THEN** each tool SHALL expose its description and input schema, and SHALL NOT execute an editor mutation on the server

#### Scenario: Tool declaration is checked without an LLM

- **WHEN** the server tool declaration test inspects the tools
- **THEN** it SHALL verify that no editing tool has a placeholder `execute` function

### Requirement: Client executes editing tools and reports the real result

The chat client SHALL execute editing tools through `onToolCall` and SHALL call `addToolOutput` only after the editor operation has completed. The output MUST contain the actual success, conflict, precondition, validation, or editor error result.

#### Scenario: Successful editor mutation

- **WHEN** `onToolCall` receives a valid editing tool call and the editor operation succeeds
- **THEN** the client SHALL apply the mutation and report `ok: true` with the resulting document revision

#### Scenario: Failed editor mutation

- **WHEN** revision, target block, expected text, schema, or editor execution validation fails
- **THEN** the client SHALL leave the document unchanged and report a non-success tool output with a stable failure reason

#### Scenario: Tool result continues the conversation

- **WHEN** all tool calls in an assistant message have real outputs
- **THEN** `lastAssistantMessageIsCompleteWithToolCalls` SHALL allow the next model step to consume those outputs

### Requirement: Chat UI reports only verified document changes as success

The chat UI SHALL derive operation success from the real client tool output and SHALL NOT treat an assistant text response or a generic `output-available` state as proof that the document changed.

#### Scenario: Verified success bubble

- **WHEN** a client tool returns `ok: true` and a current document revision
- **THEN** the UI SHALL show a success result with the operation type and actual target information

#### Scenario: Model claims completion without a tool call

- **WHEN** the assistant returns completion text but no editing tool call was executed
- **THEN** the UI SHALL NOT show a verified document mutation success state

#### Scenario: Tool conflict or failure

- **WHEN** a tool output reports a revision mismatch, precondition failure, validation failure, or editor error
- **THEN** the UI SHALL show the failure state and SHALL NOT show a success state

### Requirement: Chat editing normalizes suffixed block IDs at the editor boundary

The chat client SHALL accept model operation IDs with the document-state `$` suffix and SHALL strip only that protocol suffix before calling BlockNote editor APIs. Unknown IDs MUST be rejected instead of silently targeting another block.

#### Scenario: Valid suffixed target ID

- **WHEN** a tool call contains `targetBlockId` or `referenceBlockId` ending in `$` and the underlying editor block exists
- **THEN** the client SHALL strip the suffix for the BlockNote lookup and execute against the matching block

#### Scenario: Unknown target ID

- **WHEN** the normalized ID does not exist in the editor
- **THEN** the client SHALL return a precondition failure and SHALL NOT mutate the document

### Requirement: Chat supports atomic text range replacement

The chat editing protocol SHALL support a `replaceText` operation for a single block. The operation MUST carry `baseDocumentRevision`, `targetBlockId`, `from`, `to`, `expectedText`, and `replacement`. The client SHALL validate the range and compare the current text with `expectedText` before mutating the editor.

#### Scenario: Replace selected text

- **WHEN** the current revision matches, the target block exists, the range is valid, and the range text equals `expectedText`
- **THEN** the client SHALL replace exactly that range in one editor transaction and return the new revision

#### Scenario: Expected text changed

- **WHEN** the current text in the requested range differs from `expectedText`
- **THEN** the client SHALL reject the operation without changing the document and return a precondition failure

#### Scenario: Text replacement revision conflict

- **WHEN** `baseDocumentRevision` differs from the current editor revision
- **THEN** the client SHALL reject the operation without changing the document and return a revision conflict

### Requirement: Client-side chat editing is independently testable

Chat editing tests MUST use a mock editor and mock transport or deterministic UI message streams. They MUST NOT require a real LLM, provider network, JWT integration, or persistence service.

#### Scenario: Tool ownership test

- **WHEN** the chat service and client hook tests run
- **THEN** they SHALL verify server declaration, client execution, real output reporting, and continuation without a provider request

#### Scenario: Slash replacement regression test

- **WHEN** the editor contains `slash` and the user requests replacing it with `斜线`
- **THEN** the test SHALL verify the document content changes to `斜线` and the UI reports the actual successful tool result
