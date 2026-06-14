import { createSSRApp } from "vue";
import App from "./App.vue";
import "./index.css";
import "./bingo-exact-theme.css";
export function createApp() {
	const app = createSSRApp(App);
	return {
		app,
	};
}
