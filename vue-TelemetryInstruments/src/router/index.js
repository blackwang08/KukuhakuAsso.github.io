import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Puzzle from '../views/Puzzle.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/puzzle/:level', component: Puzzle, props: true }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
