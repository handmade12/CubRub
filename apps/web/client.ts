import { h, render } from "preact";
import { App } from "./App.tsx";
import "./assets/styles.css";

const root = document.getElementById("app");
if (!root) throw new Error("App root is missing");

render(h(App, {}), root);
