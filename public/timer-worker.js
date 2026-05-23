// Web Worker cho NaUVie Server Hop
// Worker thread KHÔNG bị trình duyệt throttle khi tab chạy nền

let interval = null;

self.onmessage = function(e) {
  if (e.data === 'start') {
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
      self.postMessage('tick');
    }, 1000);
  } else if (e.data === 'stop') {
    if (interval) clearInterval(interval);
    interval = null;
  }
};
