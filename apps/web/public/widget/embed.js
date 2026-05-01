(function () {
  var container = document.getElementById('dineroot-widget');
  if (!container) return;

  var slug = container.getAttribute('data-restaurant');
  if (!slug) {
    console.error('DineRoot Widget: data-restaurant attribute is required');
    return;
  }

  var width = container.getAttribute('data-width') || '100%';
  var height = container.getAttribute('data-height') || '620';
  var baseUrl = 'https://dineroot.com';

  // Use localhost in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    baseUrl = 'http://localhost:3000';
  }

  var iframe = document.createElement('iframe');
  iframe.src = baseUrl + '/widget/' + slug;
  iframe.style.width = width;
  iframe.style.height = height + 'px';
  iframe.style.border = '1px solid #e5e7eb';
  iframe.style.borderRadius = '16px';
  iframe.style.overflow = 'hidden';
  iframe.style.maxWidth = '400px';
  iframe.setAttribute('title', 'Book a table on DineRoot');
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('allow', 'payment');

  container.appendChild(iframe);
})();
