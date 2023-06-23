;(function() {
  const root = document.documentElement;
  function calc() {
    root.style.setProperty('--viewport', window.innerWidth);
  }
  calc()
  window.addEventListener('resize', calc);
  screen.orientation.addEventListener('orientationchange', calc);
})();