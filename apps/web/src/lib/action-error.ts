/** Shape of `result.serverError` from every Server Action (see server/safe-action.ts). */
export interface ActionError {
  message: string;
  /** Form field the error belongs to, when the service knows (e.g. "slug"). */
  field?: string;
}
