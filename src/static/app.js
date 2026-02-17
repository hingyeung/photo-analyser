(function () {
  var allImages = [];
  var currentSort = 'created_at';
  var currentOrder = 'desc';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSortedImages() {
    return allImages.slice().sort(function (a, b) {
      var aVal, bVal;
      if (currentSort === 'overall_impact') {
        aVal = a.overall_impact != null ? a.overall_impact : -1;
        bVal = b.overall_impact != null ? b.overall_impact : -1;
      } else if (currentSort === 'filename') {
        aVal = a.filename;
        bVal = b.filename;
      } else {
        aVal = a.created_at;
        bVal = b.created_at;
      }
      if (aVal < bVal) return currentOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function renderCard(img) {
    var badge;
    if (img.processed && img.overall_impact != null) {
      var cls = img.overall_impact >= 7 ? 'green' : img.overall_impact >= 4 ? 'amber' : 'red';
      badge = '<span class="badge badge-' + cls + '">' + img.overall_impact + '/10</span>';
    } else {
      badge = '<span class="badge badge-grey">Pending</span>';
    }
    return '<a href="#/image/' + encodeURIComponent(img.filename) + '" class="card">' +
      '<div class="card-image">' +
      '<img src="photos/' + encodeURIComponent(img.filename) + '" alt="' + escapeHtml(img.filename) + '" loading="lazy">' +
      '</div>' +
      '<div class="card-info">' +
      '<span class="card-filename">' + escapeHtml(img.filename) + '</span>' +
      badge +
      '</div>' +
      '</a>';
  }

  function renderGallery() {
    var sorted = getSortedImages();
    var sortLinks = ['created_at', 'filename', 'overall_impact'].map(function (s) {
      var label = s === 'created_at' ? 'Date added' : s === 'filename' ? 'Filename' : 'Score';
      return '<a href="#" data-sort="' + s + '" class="' + (currentSort === s ? 'active' : '') + '">' + label + '</a>';
    }).join('');

    document.querySelector('main').innerHTML =
      '<div class="gallery-header">' +
      '<h1>Gallery</h1>' +
      '<p class="count">' + allImages.length + ' image' + (allImages.length !== 1 ? 's' : '') + '</p>' +
      '<div class="sort-controls"><label>Sort by:</label>' + sortLinks + '</div>' +
      '</div>' +
      '<div class="gallery-grid">' +
      sorted.map(renderCard).join('') +
      '</div>';

    document.querySelectorAll('[data-sort]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var sort = el.getAttribute('data-sort');
        if (sort === currentSort) {
          currentOrder = currentOrder === 'desc' ? 'asc' : 'desc';
        } else {
          currentSort = sort;
          currentOrder = sort === 'filename' ? 'asc' : 'desc';
        }
        renderGallery();
      });
    });
  }

  function renderAnalysis(analysis) {
    var scoreKeys = ['composition', 'lighting', 'color_and_tone', 'subject_storytelling', 'technical_execution', 'overall_impact'];
    var rows = scoreKeys.map(function (key) {
      var val = analysis[key];
      var cls = val >= 7 ? 'green' : val >= 4 ? 'amber' : 'red';
      return '<div class="score-row">' +
        '<span class="score-label">' + key.replace(/_/g, ' ') + '</span>' +
        '<div class="score-bar-bg"><div class="score-bar score-bar-' + cls + '" style="width:' + (val * 10) + '%"></div></div>' +
        '<span class="score-value">' + val + '</span>' +
        '</div>';
    }).join('');

    var keywords = (analysis.keywords || []).map(function (kw) {
      return '<span class="keyword">' + escapeHtml(kw) + '</span>';
    }).join('');

    return '<div class="scores"><h3>Scores</h3>' + rows + '</div>' +
      '<div class="detail-section"><h3>Comment</h3><p>' + escapeHtml(analysis.comment) + '</p></div>' +
      '<div class="detail-section"><h3>Caption</h3><p>' + escapeHtml(analysis.caption) + '</p></div>' +
      '<div class="detail-section"><h3>Keywords</h3><div class="keywords">' + keywords + '</div></div>';
  }

  function renderMetadata(img) {
    var rows = [];
    if (img.exif_camera) rows.push('<tr><td>Camera</td><td>' + escapeHtml(img.exif_camera) + '</td></tr>');
    if (img.exif_date_taken) rows.push('<tr><td>Date taken</td><td>' + escapeHtml(img.exif_date_taken) + '</td></tr>');
    if (img.width && img.height) rows.push('<tr><td>Dimensions</td><td>' + img.width + ' x ' + img.height + '</td></tr>');
    if (img.file_size_bytes) rows.push('<tr><td>File size</td><td>' + (img.file_size_bytes / 1024 / 1024).toFixed(2) + ' MB</td></tr>');
    if (img.exif_gps_lat && img.exif_gps_lon) rows.push('<tr><td>GPS</td><td>' + img.exif_gps_lat.toFixed(5) + ', ' + img.exif_gps_lon.toFixed(5) + '</td></tr>');
    if (rows.length === 0) return '';
    return '<div class="detail-section"><h3>Metadata</h3><table class="meta-table">' + rows.join('') + '</table></div>';
  }

  function renderDetail(filename) {
    fetch('data/' + encodeURIComponent(filename) + '.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(function (img) {
        var sorted = getSortedImages();
        var idx = sorted.findIndex(function (i) { return i.filename === filename; });
        var prev = idx > 0 ? sorted[idx - 1] : null;
        var next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

        var nav = '<div class="detail-nav">' +
          (prev ? '<a href="#/image/' + encodeURIComponent(prev.filename) + '">&laquo; Previous</a>' : '<span></span>') +
          '<a href="#/">Back to Gallery</a>' +
          (next ? '<a href="#/image/' + encodeURIComponent(next.filename) + '">Next &raquo;</a>' : '<span></span>') +
          '</div>';

        document.querySelector('main').innerHTML = nav +
          '<div class="detail-container">' +
          '<div class="detail-image"><img src="photos/' + encodeURIComponent(img.filename) + '" alt="' + escapeHtml(img.filename) + '"></div>' +
          '<div class="detail-sidebar">' +
          '<h2>' + escapeHtml(img.filename) + '</h2>' +
          (img.analysis ? renderAnalysis(img.analysis) : '<div class="detail-section"><p class="pending-text">Analysis not yet available.</p></div>') +
          renderMetadata(img) +
          '</div>' +
          '</div>';
      })
      .catch(function () {
        document.querySelector('main').innerHTML = '<p>Image not found.</p>';
      });
  }

  function handleHash() {
    var hash = window.location.hash;
    var match = hash.match(/^#\/image\/(.+)$/);
    if (match) {
      renderDetail(decodeURIComponent(match[1]));
    } else {
      renderGallery();
    }
  }

  fetch('data/index.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      allImages = data.images;
      window.addEventListener('hashchange', handleHash);
      handleHash();
    })
    .catch(function () {
      document.querySelector('main').innerHTML = '<p>Failed to load image data.</p>';
    });
})();
