---
updatedAt: 2026-10-21
description: 记一次深度相机深度数据断流 Debug 经历
title: ROS 2 Cyclone DDS 组播导致相机深度断流
published: false
tags:
  - ros2
  - realsense
  - mid360
---
## 事故还原
## 原因剖析

###  省流

### 什么是DDS

### Fast DDS  vs Cyclone DDS

### ROS2 component

### 单播/组播

## 解决方案




 ### 1. 之前为什么切换到 Cyclone DDS？                                                                                   
                                                                                                                         
 根据 docs/PROJECT_ARCHITECTURE.md 第 2.1 节记录，切换到 Cyclone DDS 是为了解决 Fast DDS 在 ROS 2 Humble 下的            
 Action/Service 丢失致命缺陷：                                                                                           
                                                                                                                         
 - 上游缺陷：ros2/rmw_fastrtps#842                                                                                       
 - 故障机制：Fast DDS 将请求（request）与响应（reply）端点分开独立发现。冷启动时，导航 Action 的请求已送达且下位机已执行 
   成功（发布 SUCCEEDED），但由于响应端点尚未完成匹配，Goal response 被静默丢弃。                                        
 - 后果：任务状态机 fruit_mission 无法获取 Goal handle，整个比赛流程永久卡死在等待状态。                                 
 - 结论：为了保证比赛状态机和导航 Action 的确定性推进，项目在 2026 年 8 月规范全车强制使用 rmw_cyclonedds_cpp。

单播/组播 定义 计算机网络

### 2. Fast DDS 也会有这个问题吗？                                                                                      
                                                                                                                         
 不会出现完全相同的“本机图像数据被雷达百兆网口限速”问题，但会引发其他严重问题。                                          
                                                                                                                         
 #### 为什么 Fast DDS 在这里不会堵死网口：                                                                               
                                                                                                                         
 1. 本机默认使用共享内存（Shared Memory, SHM）：                                                                         
    Fast DDS 在单机多进程通信时，默认优先走 /dev/shm 共享内存。相机与同机节点传输原始图像时，数据直接在内存中传递，默认  
    不走物理网卡队列。                                                                                                   
 2. 用户数据默认单播：                                                                                                   
    Fast DDS 的节点发现使用组播，但用户话题（如图像）默认使用单播或共享内存，不会因为插入有线网口就自动将大图像广播到百  兆网络。                      


原本图像和推理节点是开了component的，通信都是在内存中通信， 但是因为我弄了那个