const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));

  await page.goto('http://localhost:8000/publications.html', { waitUntil: 'networkidle' });

  // 初始：全部论文可见
  const total = await page.locator('#paperList .ddw-paper').count();
  const visibleAll = await page.locator('#paperList .ddw-paper:visible').count();
  console.log('全部论文总数:', total, '| 初始可见:', visibleAll);

  // 点击"肿瘤生物学"筛选
  await page.click('.ddw-filter-btn[data-filter="肿瘤生物学"]');
  await page.waitForTimeout(300);
  const visibleTumor = await page.locator('#paperList .ddw-paper:visible').count();
  console.log('筛选[肿瘤生物学]后可见:', visibleTumor);

  // 点击"代谢与糖尿病"
  await page.click('.ddw-filter-btn[data-filter="代谢与糖尿病"]');
  await page.waitForTimeout(300);
  const visibleMeta = await page.locator('#paperList .ddw-paper:visible').count();
  console.log('筛选[代谢与糖尿病]后可见:', visibleMeta);

  // 点击"全部"
  await page.click('.ddw-filter-btn[data-filter="all"]');
  await page.waitForTimeout(300);
  const visibleAll2 = await page.locator('#paperList .ddw-paper:visible').count();
  console.log('筛选[全部]后可见:', visibleAll2);

  // 验证筛选后可见的论文分类是否正确
  await page.click('.ddw-filter-btn[data-filter="肿瘤生物学"]');
  await page.waitForTimeout(300);
  const wrongCats = await page.locator('#paperList .ddw-paper:visible[data-cats!="肿瘤生物学"]').count();
  console.log('筛选[肿瘤生物学]时非该类论文数(应为0):', wrongCats);

  console.log('JS错误:', errors.length ? errors : '无');
  await browser.close();
})();
