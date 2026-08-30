---
title: robviz ロボット可視化ツール
description: ROS2 ベースの軽量な 2D ロボット姿勢・地図可視化ツール。
createdAt: 2026-08-30T00:00:00.000Z
published: true
slug: 20260830-01
github: https://github.com/Edmounds/robviz
tags:
  - ros2
  - visualization
---

## プロジェクト概要

robviz は、ROS2 ベースの軽量な 2D ロボット姿勢・地図可視化ツールです。リソース消費を極めて抑えたリアルタイムデバッグビューの提供を目的としています。

## 特徴

- 依存関係を最小限に抑え、ROS2 のコア基盤ライブラリのみに依存
- `/map` と `/tf` の座標フレームをリアルタイムで購読
- カスタムのロボット輪郭と LiDAR 点群レイヤーに対応