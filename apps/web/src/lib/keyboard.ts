/**
 * True while a dialog is visible (global shortcuts stay quiet then). Hidden routes kept mounted
 * by Next may still hold closed ones, hence the visibility check.
 */
export function dialogIsOpen(): boolean {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[role=dialog],[role=alertdialog]"),
  ).some((el) => el.checkVisibility());
}

/** True when the key event comes from a text field, where letters are typing, not shortcuts. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

/** A plain key press with no modifiers, outside text fields and dialogs. */
export function isBareShortcut(event: KeyboardEvent): boolean {
  return (
    !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target) && !dialogIsOpen()
  );
}
