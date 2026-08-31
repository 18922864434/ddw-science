/* ============================================================
   DDW 学术站 — 视频合集页逻辑
   依赖：jquery-3.6.0.min.js / video-config.js（提供 window.VIDEO_COLLECTIONS）

   URL 约定：
     videos.html?c=<合集id>          打开指定合集，默认选中第一个视频
     videos.html?c=<合集id>&v=<视频id> 深链到指定视频
     videos.html                     回退到配置中的第一个合集
     videos.html?c=xxx（不存在）      渲染友好空态
   ============================================================ */
(function ($) {
  'use strict';

  var COLLECTIONS = window.VIDEO_COLLECTIONS || {};

  /* ---------- 读取 URL 参数 ---------- */
  function getParam(name) {
    var match = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
    return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
  }

  var colId = getParam('c');
  var videoId = getParam('v');

  // 无参数时回退到第一个合集
  if (!colId) {
    var keys = Object.keys(COLLECTIONS);
    if (keys.length) colId = keys[0];
  }

  var col = COLLECTIONS[colId];

  /* ---------- 元素引用 ---------- */
  var $playerBox = $('#playerBox');
  var $player = $('#ddwPlayer');
  var player = $player[0];

  /* ---------- HTML 转义（配置内容一律转义后再插入） ---------- */
  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 合集不存在：渲染空态 ---------- */
  if (!col) {
    $('#colTabs').hide();
    $('#videoMain').hide();
    $('#videoEmpty').show();
    $('#colTitle').text('视频合集');
    $('#colSubtitle').text('未找到指定的视频合集');
    $('#colCrumb').text('视频合集');
    document.title = '视频合集未找到 | DDW Science';
    return;
  }

  /* ---------- 渲染 Hero ---------- */
  $('#colEyebrow').text(col.eyebrow || '视频合集');
  $('#colTitle').text(col.title || '视频合集');
  $('#colSubtitle').text(col.subtitle || '');
  $('#colCrumb').text(col.title || '视频合集');
  document.title = (col.title || '视频合集') + ' | DDW Science';

  /* ---------- 渲染合集切换 tab ---------- */
  var $tabs = $('#colTabs');
  $.each(COLLECTIONS, function (key, item) {
    var cls = (key === colId) ? ' class="active"' : '';
    $tabs.append(
      '<li><a href="videos.html?c=' + encodeURIComponent(key) + '"' + cls + '>' +
      esc(item.title || key) + '</a></li>'
    );
  });

  /* ---------- 渲染视频列表 ---------- */
  var videos = $.isArray(col.videos) ? col.videos : [];
  $('#listHead').text('视频列表（' + videos.length + '）');

  var $list = $('#videoList');
  if (!videos.length) {
    $list.append('<div style="padding:30px 16px;text-align:center;color:var(--ddw-muted);font-size:14px;">该合集暂无视频</div>');
  } else {
    $.each(videos, function (i, v) {
      $list.append(
        '<div class="ddw-video-item" data-index="' + i + '" data-id="' + esc(v.id) + '">' +
          '<div class="thumb-wrap">' +
            '<video class="thumb" src="' + esc(v.src) + '#t=0.1" alt="' + esc(v.title) + '"' +
            ' preload="metadata" muted playsinline' +
            ' onerror="this.style.visibility=\'hidden\'"></video>' +
            '<span class="v-duration">' + esc(v.duration) + '</span>' +
          '</div>' +
          '<div class="v-info">' +
            '<div class="v-title">' + esc(v.title) + '</div>' +
            '<div class="v-speaker">' + esc(v.speaker || '') + '</div>' +
          '</div>' +
        '</div>'
      );
    });
  }

  /* ---------- 播放指定视频 ---------- */
  function playVideo(index, doScroll) {
    var v = videos[index];
    if (!v) return;

    // 播放器换源（src 附加 #t=0.1 让初始加载显示第一帧，取代静态 poster）
    if (v.src) {
      $playerBox.removeClass('is-empty');
      player.src = v.src + '#t=0.1';
      player.poster = v.thumb || '';
      player.load();
    } else {
      // src 缺失 → 占位层
      $playerBox.addClass('is-empty');
      player.removeAttribute('src');
      player.poster = v.thumb || '';
      player.load();
    }

    // 时长回填：duration 字段为空时，等 metadata 加载后动态填充
    player.onloadedmetadata = function () {
      var d = player.duration;
      if (d && isFinite(d)) {
        var m = Math.floor(d / 60), s = Math.floor(d % 60);
        $('#nowDuration').text(m + ':' + (s < 10 ? '0' + s : s));
      }
    };
    // 加载失败兜底：显示「视频即将上线」占位层
    player.onerror = function () {
      $playerBox.addClass('is-empty');
    };

    // 更新信息区
    $('#nowTitle').text(v.title || '');
    $('#nowSpeaker').text(v.speaker || '');
    $('#nowDuration').text(v.duration || '');
    $('#nowDesc').text(v.desc || '');

    // 高亮当前项
    $list.find('.ddw-video-item').removeClass('active')
      .filter('[data-index="' + index + '"]').addClass('active');

    // 同步 URL（可复制分享）
    var qs = '?c=' + encodeURIComponent(colId);
    if (v.id) qs += '&v=' + encodeURIComponent(v.id);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', qs);
    }

    // 移动端点击后滚回播放器
    if (doScroll && window.innerWidth < 992) {
      $('html, body').animate({ scrollTop: $playerBox.offset().top - 80 }, 400);
    }
  }

  /* ---------- 列表点击 ---------- */
  $list.on('click', '.ddw-video-item', function () {
    playVideo(parseInt($(this).data('index'), 10), true);
  });

  /* ---------- 初始化：优先深链 ?v=，否则第一个 ---------- */
  var startIndex = 0;
  if (videoId) {
    for (var i = 0; i < videos.length; i++) {
      if (videos[i].id === videoId) { startIndex = i; break; }
    }
  }

  if (videos.length) {
    playVideo(startIndex, false);
  } else {
    $playerBox.addClass('is-empty');
  }

})(jQuery);
