import { router } from './router.ts';

self.onmessage = (e) => {
  const { points, costMap } = e.data;
  let allSegments: any[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const segments = router.route(points[i], points[i + 1], costMap);
    allSegments = allSegments.concat(segments);
  }

  self.postMessage(allSegments);
};
