import { router } from './router.ts';

self.onmessage = (e) => {
  const { startPin, endPin, costMap } = e.data;
  const segments = router.route(startPin, endPin, costMap);
  self.postMessage(segments);
};