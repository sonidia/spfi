type TabOrientation = "horizontal" | "vertical" | "both";

export function useTabKeyboardNavigation(orientation: TabOrientation = "horizontal") {
  function handleTabKeydown(event: KeyboardEvent) {
    const horizontalKeys = ["ArrowLeft", "ArrowRight"];
    const verticalKeys = ["ArrowUp", "ArrowDown"];
    const allowedKeys = [
      "Home",
      "End",
      ...(orientation !== "vertical" ? horizontalKeys : []),
      ...(orientation !== "horizontal" ? verticalKeys : []),
    ];
    if (!allowedKeys.includes(event.key)) return;

    const container = event.currentTarget as HTMLElement;
    const tabs = Array.from(
      container.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'),
    );
    if (!tabs.length) return;

    const current = Math.max(0, tabs.indexOf(document.activeElement as HTMLElement));
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    let next: number;

    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else if (forward) next = (current + 1) % tabs.length;
    else next = current <= 0 ? tabs.length - 1 : current - 1;

    event.preventDefault();
    tabs[next]?.focus();
  }

  return { handleTabKeydown };
}
