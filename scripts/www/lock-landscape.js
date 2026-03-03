document.addEventListener("DOMContentLoaded", function () {
  if (window.plus) {
    plus.screen.lockOrientation("landscape-primary");
    plus.navigator.setFullscreen(true);
  }
  window.addEventListener("orientationchange", function () {
    if (window.plus) {
      plus.screen.lockOrientation("landscape-primary");
    }
  });
});
window.screen.orientation
  ?.lock("landscape")
  .catch((err) => console.log("横屏锁定:", err));
