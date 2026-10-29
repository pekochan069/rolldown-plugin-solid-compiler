import { render } from "@solidjs/web";
import { createSignal } from "solid-js";

export function mount(root: Element) {
  const [count, setCount] = createSignal(0);
  return render(
    () => (
      <button onClick={() => setCount((value) => value + 1)}>
        Count: {count()}
      </button>
    ),
    root,
  );
}
