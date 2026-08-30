---
title: robviz 機器人視覺化工具
description: 基於 ROS2 的輕量級 2D 機器人位姿與地圖視覺化工具。
createdAt: 2026-08-30T00:00:00.000Z
published: true
slug: 20260830-01
github: https://github.com/Edmounds/robviz
tags:
  - ros2
  - visualization
---

## 專案簡介

robviz 是一個基於 ROS2 的輕量級 2D 機器人位姿與地圖視覺化工具，旨在提供資源占用極低的即時除錯視圖。

## 功能特色

- 極簡相依套件，僅依賴核心 ROS2 基礎函式庫
- 即時訂閱 `/map` 與 `/tf` 座標系
- 支援自訂機器人輪廓與雷射雷達點雲圖層