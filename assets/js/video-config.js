/* ============================================================
   视频合集配置 —— 全站视频数据的唯一维护入口
   ============================================================

   维护方式：
   1) 新增合集：复制下面任意一整块，改掉 id（同时它就是 URL 参数 ?c= 的值），
      再往 conferences.html 加一个指向 videos.html?c=<id> 的按钮即可。
   2) 新增视频：往对应合集的 videos 数组里追加一条。
   3) 上线视频：把每条视频的 src 换成真实 MP4 地址、thumb 换成真实缩略图。

   路径说明：
   - src   ：MP4 播放地址。本配置中 src 为已 URL 编码的完整 URL（含特殊字符的
             文件名如 á/ó 已编码为 %C3%A1/%C3%B3），直接用于 <video src>。
             也可填站内相对路径，如 assets/video/lectures/lec-01.mp4
   - thumb ：封面缩略图。当前留空 ""，前端用视频 src + #t=0.1 自动渲染第一帧。
             若后续有静态封面图，可填绝对 URL 或站内相对路径。
   - src 留空时，播放器会显示「视频即将上线」占位层，不会报错

   视频 ID（videos[].id）用于深链分享：videos.html?c=<合集id>&v=<视频id>

   远程视频源：https://preventa-website.idhealth.cn/uploads/video/
   - lectures/  大会演讲（14 条，fMP4）
   - interview/ 专家访谈（7 条，fMP4）
   ============================================================ */

window.VIDEO_COLLECTIONS = {

  /* ------------------------------------------------------------
     合集一：ICDD 大会演讲（14 条）
     conferences.html 的「观看大会演讲」按钮指向此 id
     ------------------------------------------------------------ */
  "icdd-lectures": {
    id: "icdd-lectures",
    eyebrow: "大会演讲",
    title: "ICDD 大会演讲合集",
    subtitle: "国际低氘大会（ICDD）历届主旨演讲与专题报告",
    videos: [
      { id: "lec-01", title: "Anton Chernopyatko《Effect of Deuterium Depletion Water...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/AntonChernopyatkoEffectofDeuteriumDepletionWateronIntracellularParametersofCorticalNeuronsDuringGlutamateExcitotoxicity.mp4",
        desc: "" },
      { id: "lec-02", title: "Gábor I. Csonka《Gene Expression in A549...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/G%C3%A1bor.mp4",
        desc: "" },
      { id: "lec-03", title: "Gábor Somlyai《Clinical Evidence for the Anticancer Effect...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/G%C3%A1borSomlyai.mp4",
        desc: "" },
      { id: "lec-04", title: "Gábor Somlyai《The Impact of Deuterium on Cell Cycle...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/Metabolism.mp4",
        desc: "" },
      { id: "lec-05", title: "István Fórizs《An Overview of Deuterium Variability...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/Istv%C3%A1nF%C3%B3rizs.mp4",
        desc: "" },
      { id: "lec-06", title: "Jackoline Milne《Prairie Polyculture Fermented Feed Systems...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/JackolineMilne.mp4",
        desc: "" },
      { id: "lec-07", title: "Joel Gould《Fasting-Mimicking Diet...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/DeuteriumFractionation.mp4",
        desc: "" },
      { id: "lec-08", title: "Liu Yuting《Research Progress and Industrial Exploration...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/LiuYutingResearch.mp4",
        desc: "" },
      { id: "lec-09", title: "László G. Boros《Medical Deutenomics...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/RoadAhead.mp4",
        desc: "" },
      { id: "lec-10", title: "Roman A Zubarev《Active Role of Stable Isotopes...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/DeuteriumBeyond.mp4",
        desc: "" },
      { id: "lec-11", title: "Stephanie Seneff《Are Small Hydrogen-Containing Gas Molecules...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/MitochondrialWater.mp4",
        desc: "" },
      { id: "lec-12", title: "Tatyana Strekalova《The Study of Molecular Mechanisms...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/Deuterium-DepletedWater.mp4",
        desc: "" },
      { id: "lec-13", title: "Valentin I. Lobyshev《The Basic Principles...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/BiologicalSystems.mp4",
        desc: "" },
      { id: "lec-14", title: "Zoltán Gyöngyi《Deuterium Depleted Water (DDW)...》",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/lectures/LungCancer.mp4",
        desc: "" }
    ]
  },

  /* ------------------------------------------------------------
     合集二：专家访谈（7 条）
     conferences.html 的「观看专家访谈」按钮指向此 id
     ------------------------------------------------------------ */
  "expert-interviews": {
    id: "expert-interviews",
    eyebrow: "专家访谈",
    title: "国际专家访谈合集",
    subtitle: "全球顶尖研究者谈氘耗减的临床与基础研究",
    videos: [
      { id: "int-01", title: "Andrew Lemon interview",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/interview/AndrewLemoninterview.mp4",
        desc: "" },
      { id: "int-02", title: "Anton Chernopyatko interview",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/interview/AntonChernopyatkointerview.mp4",
        desc: "" },
      { id: "int-03", title: "Gábor I. Csonka interview",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/interview/Csonkainterview.mp4",
        desc: "" },
      { id: "int-04", title: "Gábor Somlyai interview",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/interview/G%C3%A1borSomlyaiinterview.mp4",
        desc: "" },
      { id: "int-05", title: "Liu Yuting interview",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/interview/LiuYutinginterview.mp4",
        desc: "" },
      { id: "int-06", title: "László G. Boros interview",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/interview/L%C3%A1szl%C3%B3GBorosinterview.mp4",
        desc: "" },
      { id: "int-07", title: "Roman A. Zubarev interview",
        speaker: "", duration: "", thumb: "",
        src: "https://preventa-website.idhealth.cn/uploads/video/interview/RomanAZubarevinterview.mp4",
        desc: "" }
    ]
  }

};
