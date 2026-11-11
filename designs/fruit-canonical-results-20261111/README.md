# 果蔬识别正规数据重训图表

实验：`canonical_rebuild_20261111`。文章保持 `published: false`。

60张外部图片含91个标注目标。复合标签完整识别39个，两阶段完整识别46个。水果6/41→13/41，蔬菜均为33/50。所有统计均使用固定评测集及阈值。

- `exports/`：8张300dpi PNG及对应SVG。
- `plot_results.py`：读取固定图像和已记录预测，生成图表。
- `summary.json`：全体、分区和分批次统计，以及模型与协议哈希。
- `independent-verification.json`：独立匹配统计核对结果。
- `export-parity.json`：16组PyTorch/ONNX抽样对照结果。
- `sample-provenance.json`：类型与状态样例的来源。
- `case-provenance.json`：四个预测案例及选择规则。
- `paired-image-outcomes.json`：逐图配对识别结果。
- `target-hue-histograms.json`：91个目标的色相统计。
- `assets-local.json`、`upload-receipts.json`：本地图像哈希及R2上传记录。
- `article-verification.json`：项目Markdown处理器的渲染检查结果。
- `public-image-verification.json`：浏览器下载、解码及SHA256检查结果。

复现图表需要原实验目录及其Python环境：

```bash
/Users/cqc/fruit_train/.venv/bin/python designs/fruit-canonical-results-20261111/plot_results.py
```

复核评测计数和行为测试：

```bash
cd /Users/cqc/fruit_train/output/canonical_rebuild_20261111
/Users/cqc/fruit_train/.venv/bin/python scripts/verify_results.py
/Users/cqc/fruit_train/.venv/bin/python scripts/test_evaluation.py
```

文章检查已通过：`npm run content:prepare`、`npm run check:content-ids`、`npm run check:encoding`、`npm run check`。Astro检查214个文件，错误、警告及提示均为0。已使用项目Satteri处理器渲染正文，确认8张图、8个非空alt和4个章节标题。

未执行整站构建及部署。构建前置流程会同步其他图片和翻译，本次仅更新草稿及其图表。图片已上传，文章尚未发布。

Cloudflare只读检查确认认证、R2、自定义域名、部署查询、D1读取和网站边缘访问通过。检查脚本仍查询旧Worker `blog-web-core`及已移除的`wrangler.preferred-proxy.jsonc`，对应两项检查失败。本任务未修改这些配置。终端下载新图返回403，图片可用性以浏览器下载和解码结果为准。

本轮是单种子、小样本的两套流程比较。外部集曾在作废实验中查看，不是全新盲测。没有按本轮结果调阈值或换样本。两阶段增加六个分类器，不能把全部差异归因于标签拆分。

用户随后要求取消0.25过滤，按每个目标的最高分候选补充评测，并检查视频换类相关的类别分差。补充结果为双方均66/91，原有39/46基线保持不变。专用评测集身份和训练隔离已再次核对。详见[supplement-no-threshold/README.md](supplement-no-threshold/README.md)。

## 整合交接

状态：**Pending Integration**，原因：`master`有其他未提交修改。

- 仓库：`/Users/cqc/blog_web`
- 工作树：`/Users/cqc/blog_web/.worktrees/fruit-canonical-results`
- 分支：`codex/fruit-canonical-results`
- 验证基线：`af3f3e89d3562e4f0a516a49ed560dbfde34623e`
- 提交SHA：见实验目录`.planning/completion/HANDOFF.md`。

等待主工作区干净且无并发写入后，先在本工作树分析并适配最新`master`。若有冲突，比较共同祖先、`master`及任务分支，保留用户最新修改。重新执行内容和Astro检查后，只允许通过`git merge --ff-only codex/fruit-canonical-results`串行整合。若基线在验证期间变化，重新分析和验证。整合成功后再移除工作树与任务分支。
