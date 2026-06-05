import { createRouter, createWebHashHistory } from "vue-router";
import Home from "../views/Home.vue";
import PuzzleLoader from "../views/puzzleLoader.vue";

const routes = [
    { path: "/", component: Home },
    {
        path: "/puzzle/:level",
        component: PuzzleLoader,
        props: (route) => ({
            level: route.params.level,
        }),
    },
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

export default router;
