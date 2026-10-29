import { Greeting } from "./Greeting";

export function App(props: { name: string }) {
  return (
    <main>
      <Greeting name={props.name} />
      <ul>
        <For each={["one", "two"]}>{(item) => <li>{item}</li>}</For>
      </ul>
    </main>
  );
}
