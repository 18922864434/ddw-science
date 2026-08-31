/* ============================================================
   视频合集配置 —— 全站视频数据的唯一维护入口
   ============================================================

   维护方式：
   1) 新增合集：复制下面任意一整块，改掉 id（同时它就是 URL 参数 ?c= 的值），
      再往 conferences.html 加一个指向 videos.html?c=<id> 的按钮即可。
   2) 新增视频：往对应合集的 videos 数组里追加一条。
   3) 上线视频：把每条视频的 src 换成真实 MP4 地址、thumb 换成真实缩略图。

   路径说明：
   - src   ：MP4 播放地址。本配置中 src 为已 URL 编码的完整 URL（含中文目录、
             空格、á/ó/ő/í 等特殊字符均已编码），直接用于 <video src>。
   - thumb ：封面缩略图。当前留空 ""，前端用视频 src + #t=0.1 自动渲染第一帧。
   - src 留空时，播放器会显示「视频即将上线」占位层，不会报错

   视频 ID（videos[].id）用于深链分享：videos.html?c=<合集id>&v=<视频id>

   视频源（阿里云 OSS，2026-08-31 迁移）：
   https://ddw-science.oss-cn-shenzhen.aliyuncs.com/
   - 第五届低氘大会-演讲/  14 条
   - 第五届低氘大会-采访/  7 条
   文件名 = 演讲者 + 完整论文标题 + .mp4（含空格/标点，URL 已编码）
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
      { id: "lec-01",
        title: "Anton Chernopyatko《Effect of Deuterium Depletion Water on Intracellular Parameters of Cortical Neurons During Glutamate Excitotoxicity》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Anton%20Chernopyatko%20Effect%20of%20Deuterium%20Depletion%20Water%20on%20Intracellular%20Parameters%20of%20Cortical%20Neurons%20During%20Glutamate%20Excitotoxicity.mp4",
        desc: "" },
      { id: "lec-02",
        title: "Gábor I. Csonka《Gene Expression in A549 Lung Adenocarcinoma Cells in Response to Changes in Deuterium Concentration》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/G%C3%A1bor%20I.%20Csonka%20Gene%20Expression%20in%20A549%20Lung%20Adenocarcinoma%20Cells%20in%20Response%20to%20Changes%20in%20Deuterium%20Concentration.mp4",
        desc: "" },
      { id: "lec-03",
        title: "Gábor Somlyai《Clinical Evidence for the Anticancer Effect of Deuterium Depletion and Principles for its Integration into Standard Cancer Therapy》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/G%C3%A1bor%20Somlyai%20Clinical%20Evidence%20for%20the%20Anticancer%20Effect%20of%20Deuterium%20Depletion%20and%20Principles%20for%20its%20Integration%20into%20Standard%20Cancer%20Therapy.mp4",
        desc: "" },
      { id: "lec-04",
        title: "Gábor Somlyai《The Impact of Deuterium on Cell Cycle Regulation, Gene Expression, and Metabolism》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/G%C3%A1bor%20Somlyai%20The%20Impact%20of%20Deuterium%20on%20Cell%20Cycle%20Regulation%2C%20Gene%20Expression%2C%20and%20Metabolism.mp4",
        desc: "" },
      { id: "lec-05",
        title: "István Fórizs《An Overview of Deuterium Variability in the Global Water Cycle and in Some Related Natural Materials》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Istv%C3%A1n%20F%C3%B3rizs%20An%20Overview%20of%20Deuterium%20Variability%20in%20the%20Global%20Water%20Cycle%20and%20in%20Some%20Related%20Natural%20Materials.mp4",
        desc: "" },
      { id: "lec-06",
        title: "Jackoline Milne《Prairie Polyculture Fermented Feed Systems for Low-Deuterium Animal Food Production》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Jackoline%20Milne%20Prairie%20Polyculture%20Fermented%20Feed%20Systems%20for%20Low-Deuterium%20Animal%20Food%20Production.mp4",
        desc: "" },
      { id: "lec-07",
        title: "Joel Gould《Fasting-Mimicking Diet as a Metabolic Framework for Endogenous Deuterium Fractionation》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Joel%20Gould%20Fasting-Mimicking%20Diet%20as%20a%20Metabolic%20Framework%20for%20Endogenous%20Deuterium%20Fractionation.mp4",
        desc: "" },
      { id: "lec-08",
        title: "Liu Yuting《Research Progress and Industrial Exploration of Luzhou Yu Quan Deuterium Depleted Water Across Multiple Fields》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Liu%20Yuting%20Research%20Progress%20and%20Industrial%20Exploration%20of%20Luzhou%20Yu%20Quan%20Deuterium%20Depleted%20Water%20Across%20Multiple%20Fields.mp4",
        desc: "" },
      { id: "lec-09",
        title: "László G. Boros《Medical Deutenomics: How Far We've Come and the Road Ahead》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/L%C3%A1szl%C3%B3%20G.%20Boros%20Medical%20Deutenomics%20How%20Far%20We%E2%80%99ve%20Come%20and%20the%20Road%20Ahead.mp4",
        desc: "" },
      { id: "lec-10",
        title: "Roman A Zubarev《Active Role of Stable Isotopes in Biological Processes – Deuterium and Beyond》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Roman%20A%20Zubarev%20Active%20Role%20of%20Stable%20Isotopes%20in%20Biological%20Processes%20%E2%80%93%20Deuterium%20and%20Beyond.mp4",
        desc: "" },
      { id: "lec-11",
        title: "Stephanie Seneff《Are Small Hydrogen-Containing Gas Molecules Essential for Maintaining Low Deuterium in Mitochondrial Water》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Stephanie%20Seneff%20Are%20Small%20Hydrogen-Containing%20Gas%20Molecules%20Essential%20for%20Maintaining%20Low%20Deuterium%20in%20Mitochondrial%20Water.mp4",
        desc: "" },
      { id: "lec-12",
        title: "Tatyana Strekalova《The Study of Molecular Mechanisms Underlying Late-Life Depression and the Effect of Deuterium-Depleted Water》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Tatyana%20Strekalova%20The%20Study%20of%20Molecular%20Mechanisms%20Underlying%20Late-Life%20Depression%20and%20the%20Effect%20of%20Deuterium-Depleted%20Water.mp4",
        desc: "" },
      { id: "lec-13",
        title: "Valentin I. Lobyshev《The Basic Principles for Isotopic Effects of Deuterium, Containing in Water on Biological Systems》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Valentin%20I.%20Lobyshev%20The%20Basic%20Principles%20for%20Isotopic%20Effects%20of%20Deuterium%2C%20Containing%20in%20Water%20on%20Biological%20Systems.mp4",
        desc: "" },
      { id: "lec-14",
        title: "Zoltán Gyöngyi《Deuterium Depleted Water (DDW) as a Novel Adjuvant Therapy in the Small Cell and Non-Small Cell Lung Cancer》",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E6%BC%94%E8%AE%B2/Zolt%C3%A1n%20Gy%C3%B6ngyi%20Deuterium%20Depleted%20Water%20%28DDW%29%20as%20a%20Novel%20Adjuvant%20Therapy%20in%20the%20Small%20Cell%20and%20Non-Small%20Cell%20Lung%20Cancer.mp4",
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
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E9%87%87%E8%AE%BF/Andrew%20Lemon%20interview.mp4",
        desc: "" },
      { id: "int-02", title: "Anton Chernopyatko interview",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E9%87%87%E8%AE%BF/Anton%20Chernopyatko%20interview.mp4",
        desc: "" },
      { id: "int-03", title: "Gábor I. Csonka interview",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E9%87%87%E8%AE%BF/G%C3%A1bor%20I.%20Csonka%20interview.mp4",
        desc: "" },
      { id: "int-04", title: "Gábor Somlyai interview",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E9%87%87%E8%AE%BF/G%C3%A1bor%20Somlyai%20interview.mp4",
        desc: "" },
      { id: "int-05", title: "Liu Yuting interview",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E9%87%87%E8%AE%BF/Liu%20Yuting%20interview.mp4",
        desc: "" },
      { id: "int-06", title: "László G. Boros interview",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E9%87%87%E8%AE%BF/L%C3%A1szl%C3%B3%20G.%20Boros%20interview.mp4",
        desc: "" },
      { id: "int-07", title: "Roman A. Zubarev interview",
        speaker: "", duration: "", thumb: "",
        src: "https://ddw-science.oss-cn-shenzhen.aliyuncs.com/%E7%AC%AC%E4%BA%94%E5%B1%8A%E4%BD%8E%E6%B0%98%E5%A4%A7%E4%BC%9A-%E9%87%87%E8%AE%BF/Roman%20A.%20Zubarev%20interview.mp4",
        desc: "" }
    ]
  }

};
