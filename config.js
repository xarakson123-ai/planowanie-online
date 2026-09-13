document.write('<script src="config-base.js"><\/script>');
document.write('<script src="social-sync.js"><\/script>');
document.write('<script src="social.js"><\/script>');
document.write('<script src="enhancements.js"><\/script>');
document.write('<script src="fix-v10.js"><\/script>');
(function(){
  window.addEventListener('load',function(){
    document.body.style.pointerEvents='auto';
    document.querySelectorAll('.uiModal,.v8Overlay').forEach(function(e){e.remove();});
  });
})();
