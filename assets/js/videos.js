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

  /* ---------- HTML 转义 ---------- */
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

  /* ---------- 渲染视频列表（优化版：不再渲染全量视频节点，消除网络并发阻碍） ---------- */
  var videos = $.isArray(col.videos) ? col.videos : [];
  $('#listHead').text('视频列表（' + videos.length + '）');

  var $list = $('#videoList');
  if (!videos.length) {
    $list.append('<div style="padding:30px 16px;text-align:center;color:var(--ddw-muted);font-size:14px;">该合集暂无视频</div>');
  } else {
    $.each(videos, function (i, v) {
      var thumbHtml = '';
      if (v.thumb) {
        thumbHtml = '<div class="thumb-poster"><img src="' + esc(v.thumb) + '" alt="' + esc(v.title) + '"></div>';
      } else {
        // 静态 CSS 品牌渐变 + 播放图标（免除发起多余视频 HTTP 请求）
        thumbHtml = '<div class="thumb-poster"><i class="fas fa-play-circle"></i></div>';
      }

      $list.append(
        '<div class="ddw-video-item" data-index="' + i + '" data-id="' + esc(v.id) + '">' +
          '<div class="thumb-wrap">' +
            thumbHtml +
            '<span class="v-duration">' + esc(v.duration || '') + '</span>' +
          '</div>' +
          '<div class="v-info">' +
            '<div class="v-title">' + esc(v.title) + '</div>' +
            '<div class="v-speaker">' + esc(v.speaker || '') + '</div>' +
          '</div>' +
        '</div>'
      );
    });
  }

  /* ---------- 播放器状态事件监听 ---------- */
  $player.on('loadstart waiting', function () {
    if (player.src && !$playerBox.hasClass('is-empty')) {
      $playerBox.addClass('is-loading');
    }
  });

  $player.on('canplay canplaythrough playing pause ended', function () {
    $playerBox.removeClass('is-loading');
  });

  $player.on('loadedmetadata', function () {
    var d = player.duration;
    if (d && isFinite(d)) {
      var m = Math.floor(d / 60), s = Math.floor(d % 60);
      var formatted = m + ':' + (s < 10 ? '0' + s : s);
      $('#nowDuration').text(formatted);
      // 同步更新侧边栏对应项的未配置时长
      var activeIdx = $list.find('.ddw-video-item.active').data('index');
      if (activeIdx !== undefined && !videos[activeIdx].duration) {
        $list.find('.ddw-video-item.active .v-duration').text(formatted);
      }
    }
  });

  $player.on('error', function () {
    $playerBox.removeClass('is-loading').addClass('is-empty');
  });

  /* ---------- 播放指定视频 ---------- */
  function playVideo(index, doScroll) {
    var v = videos[index];
    if (!v) return;

    $playerBox.removeClass('is-loading');

    if (v.src) {
      $playerBox.removeClass('is-empty');
      player.poster = v.thumb || '';
      // 直接把真实的视频源赋予 src，取消之前列表引入的并发 #t=0.1 阻碍
      player.src = v.src;
      player.load();
    } else {
      $playerBox.addClass('is-empty');
      player.removeAttribute('src');
      player.poster = v.thumb || '';
      player.load();
    }

    // 更新文本信息
    $('#nowTitle').text(v.title || '');
    $('#nowSpeaker').text(v.speaker || '');
    $('#nowDuration').text(v.duration || '');
    $('#nowDesc').text(v.desc || '');

    // 高亮选中项
    $list.find('.ddw-video-item').removeClass('active')
      .filter('[data-index="' + index + '"]').addClass('active');

    // 同步 URL
    var qs = '?c=' + encodeURIComponent(colId);
    if (v.id) qs += '&v=' + encodeURIComponent(v.id);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', qs);
    }

    // 移动端滚动
    if (doScroll && window.innerWidth < 992) {
      $('html, body').animate({ scrollTop: $playerBox.offset().top - 80 }, 400);
    }
  }

  /* ---------- 点击列表项 ---------- */
  $list.on('click', '.ddw-video-item', function () {
    playVideo(parseInt($(this).data('index'), 10), true);
  });

  /* ---------- 初始化 ---------- */
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
