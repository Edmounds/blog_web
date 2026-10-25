---
title: robviz 機器人視覺化
description: 我們的目標是打造 Web 版的 rviz2
createdAt: 2026-08-30T00:00:00.000Z
published: true
slug: 20260830-01
github: https://github.com/Edmounds/robviz
tags:
  - ros2
  - visualization
---

## 專案簡介

robviz 是一個基於 ROS2 的輕量級 2D 機器人位姿與地圖視覺化工具，旨在提供極低資源占用的即時除錯檢視畫面。

## 特性

- 極簡依賴，僅依賴核心 ROS2 基礎函式庫
- 即時訂閱 `/map` 與 `/tf` 座標系
- 支援自訂機器人輪廓與雷射雷達點雲圖層