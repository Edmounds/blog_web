---
createdAt: 2026-10-21
description: 记一次深度相机深度数据断流 Debug 经历
title: ROS 2 Cyclone DDS 组播导致相机深度断流
published: false
tags:
  - ros2
  - realsense
  - mid360
---
## 事故还原
我的机器人同时使用了Mid360激光雷达和realsense D435if深度摄像头，Mid360通过有线网口连接，深度摄像头通过USB3.0连接。

ROS2 的DDS(Data Distribution Service)选择的是Cyclone DDS而不是默认的Fast DDS，是为了解决 Fast DDS 在 ROS 2 Humble 下的Action/Service 丢失致命缺陷。因为Fast DDS 将请求与响应端点分开独立发现。冷启动时，导航 Action 的请求已送达且下位机已执行 成功，但由于响应端点尚未完成匹配，Goal response 被静默丢弃。  导致我的任务状态机无法获取 Goal handle，进而卡死整个比赛进程。                     


我的深度摄像头驱动和yolo推理的node通过ros2 component放在一起了，RGB以及Depth数据通过内存传输而不是通过DDS传输，注意此时摄像头发布的图像话题也只是这个推理node一个subscriber，这种情况下并不会触发那个bug。

后面我干了啥导致realsense深度断流呢？

我为了更好的可视化效果，我不想再用nomachine串流到小电脑上使用rviz2查看摄像头画面了，我于是继续优化我的web可视化项目robviz，这次我为了无线串流既有画质又省带宽还要流程，我选择用webRTC来串流，于是需要在ROS端写一个node订阅摄像头画面然后再用webRTC处理一下发过去给web client端。这个时候，
## 原因剖析
ROS2的 Cyclone DDS有一个阴间策略：

Fast DDS不会有这个问题。Fast DDS 在单机多进程通信时，默认优先走 /dev/shm 共享内存。相机与同机节点传输原始图像时，数据直接在内存中传递，而不走物理网口。并且Fast DDS 只有节点发现使用组播，而用户的topic默认使用单播或共享内存，不会因为插入有线网口就自动将大图像广播到百兆网络。 


## 解决方案

## 附录
### 什么是DDS
![image.png](https://img.muelsyse.us/bed/20261025214411104.png)
### Fast DDS  vs Cyclone DDS

### ROS2 component

### 单播

### 组播