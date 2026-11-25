---
createdAt: 2026-10-21T00:00:00.000Z
description: Debugging an Interrupted Depth Data Stream from a Depth Camera
title: ROS 2 Cyclone DDS Multicast Causes Camera Depth Stream Dropouts
published: true
tags:
  - ros2
  - RealSense
  - mid360
  - DDS
  - Cyclone
slug: 20261021-01
---

## Case Review

- MID-360 LiDAR | Wired Ethernet port (100 Mbps)
- Intel RealSense D435if Depth Camera | USB 3.0
- Ubuntu 22.04 ROS 2 Humble Cyclone DDS

The camera’s RGB stream is used for inference-based recognition, and both the inference node and camera driver are componentized using ROS 2 and run in the same container.
### The problem finally came to light
We finished tuning the first version the day before the robot was due to leave. All the tests had gone smoothly, and based on the results we’d achieved at the time, we were virtually guaranteed first place nationally. We even popped champagne, thinking we had finally broken the curse of always finishing projects at the very last minute before the deadline. Alas, what was bound to happen still happened.

After finishing the tuning, I had nothing else to do, so I put together a web-based visualization. On the ROS 2 side, I ran a node that subscribed to the camera’s RGB and depth images, encoded them as H.264, and then sent them to my computer via WebRTC. When tested in isolation, everything worked as expected. But the problem was hidden precisely in that “isolation”—at the time, I hadn’t realized that I had added a cross-process subscriber outside the Component container.
### DEBUG

Four hours before departure, all the landmines I’d planted earlier blew up at once. After finishing the Web side, I was preparing to run through the entire workflow one more time. The car could move, but—wait, why couldn’t it recognize targets anymore? I checked the logs and found that the inference and recognition node hadn’t even started inference properly.

“Well, restarting the process should have, what, a 90% chance of fixing it, right?” Nope, that didn’t work. “Fine, I’ll have AI take a look.” AI checked the logs and said that the depth data appeared briefly and then cut out again, so it guessed that the camera cable was loose. I breathed a sigh of relief. A loose cable was easy enough to fix—just unplug it and plug it back in, right? Nope, still didn’t work. I tried swapping the cable, the USB port, and the Thunderbolt port, but none of it helped. I then tried gpt-6.1-sol and gpt-6-astra in turn, but neither solved the problem. Instead, they made random changes to the existing code, and at one point even made the RGB disappear.

With only an hour left before departure and the problem still unresolved, in the end I could only`git reset`I rolled back to the code that had worked yesterday. I figured that if the old version could run, it would show that the hardware itself wasn’t faulty. But surprisingly, it still failed to run.
>It was only later that I realized the WebRTC support node was in another workspace, so this rollback hadn’t affected it at all.

At the time, I really felt like the sky was falling. Software problems can still be fixed, but if the hardware is broken, there’s really nothing you can do. And since I couldn’t find a second camera, all I could do was start packing things up. Sigh… let’s go, let’s go.

On the way to the airport, I was exhausted but couldn’t fall asleep. The elevated highway was eerily empty at five in the morning, with the streetlights stretching in a line through the darkness before dawn. No one was talking, and there was no vehicle left for me to keep debugging. All I could do was sit there, unable to touch anything or change anything. The frantic anxiety that had nearly driven me crazy in the hours before setting out slowly faded in the silence. Until then, I’d been desperate to put out the fire the very next second by restarting things, swapping cables, and taking a chance on whatever help AI could offer. Yet that quiet made me realize that I could debug it manually after all—that there had to be a way to determine whether it was really a hardware problem.

When we arrived at the boarding gate, there was still half an hour before boarding. I hurriedly connected the battery to the car to test it and finally got some good news: I didn’t launch any ROS nodes and just opened the camera driver test directly. Surprisingly, both RGB and depth worked normally and the frame rate was stable. That meant the hardware was fine—it was a software problem, so it could still be fixed.

When I got to the hotel, the room was too cramped to run the entire pipeline, so I only started the camera and inference/recognition nodes; I didn’t launch anything related to the LiDAR or electronic controls. Huh—the camera was actually working normally, with both depth and RGB data coming through. Well, it turned out to be some kind of metaphysical problem after all—the code was running on its own again? I celebrated a little too early, but since it was working, I decided not to worry about it for the time being, got some restful sleep, and waited until the afternoon to debug it on-site.

Once we got into the venue and tested the entire process, the camera failed again—the depth stream was still cutting out. That was when I remembered that I hadn’t powered on the lidar or the lower-level computer at noon before starting the controlled-variable experiments. The scope was finally narrowed down: as soon as the lidar was powered on and connected to the mini PC, the camera’s depth stream would stop.

I told Gemini-3.8-Flash about the issue, and it started freaking out again, suggesting that the lidar’s infrared light might be interfering with the camera. I thought that might actually be possible. We had changed the arm’s initial position that day, and the lidar could have been scanning the camera—coincidentally, the electrical-control team had changed the arm’s initial position that very day, making the camera face directly toward the lidar. The D435 series uses active stereo structured light and also has an infrared projector, so optical interference was indeed possible.

We raised the camera by changing the arm’s initial position and also tested it with the lidar covered by hand, but the stream still kept cutting out. I then switched to GPT-6.1-sol to analyze the logs and see whether it had any new ideas. This time, GPT finally started pulling its weight, and the troubleshooting finally shifted toward the network: after capturing and analyzing the logs, we found that the camera’s raw image data might be passing through the 100 Mbps wired interface connected to the lidar???? Then, after modifying Cyclone DDS so that its data communications would no longer use multicast, everything went back to normal!

## Root Cause Analysis

### Problem Analysis

After the robot was connected to the LiDAR network, the camera stream stopped. Cyclone DDS’s`AllowMulticast`Change to`spdp`Afterward, depth-image streaming resumed, and the physical interface’s transmit rate also dropped from approximately 100 Mbps to 0.003 Mbps. This confirmed**High-bandwidth image data is sent via DDS multicast over the 100 Mbps wired network link.**This explanation.

I didn’t encounter the problem immediately after switching to Cyclone DDS because the communication topology was still relatively simple at the time: the camera and YOLO were running in the same container process and used intra-process communication. Later, I added a WebRTC node in a separate process, which needed to receive the raw images through RMW/DDS. Cyclone DDS selects network paths based on interface capabilities, configuration, and the peers it discovers. For wireless interfaces, it tends to use only discovery multicast, while for wired interfaces, it allows multicast to be used more broadly. The problem is that an interface capable of carrying multicast data does not necessarily have sufficient bandwidth—and Cyclone DDS doesn’t care about that. A 1280 × 720 RGB8 image published at 30 Hz requires approximately 664 Mbps of bandwidth, already far exceeding 100 Mbps. The network port was simply overwhelmed.

### Key Points

By this point, there’s probably still one thing that seems very strange and counterintuitive: if the data has already entered the same computer via USB, why would data communication still be affected by the physical Ethernet port?

Let me retrace the data path. The camera data enters the computer over USB, but because Linux isolates process memory, the camera driver has to hand the data off to DDS for inter-process transmission.

Cyclone DDS selects a default network interface based on its own data-group multicast strategy, and then calls Linux’s`setsockopt`function, and pass in`IP_MULTICAST_IF`parameter. This directive forces the kernel to bind the multicast socket to the specified network interface. The kernel sends the multicast packets directly to the target interface while simultaneously sending a copy to the local address, 127.0.0.1. But there’s another problem here: the local loopback transmission can only take place after the preceding task of sending the packets to the target interface has completed. In our case, the depth and RGB data is too large, completely overwhelming the narrow 100 Mbps pipe, so the local loopback copy can’t be made either.

Another question arises: why can’t the local loopback interface replicate the data here either? This again brings us to the Linux kernel’s multicast data processing path.

1. When DDS calls the system interface to send UDP data, the kernel allocates memory for the packet and deducts it from the current socket’s`SO_SNDBUF`Buffer quota
2. of packets entering the kernel`ip_mc_output`Once the function completes, the kernel immediately makes a copy and sends it to 127.0.0.1, while placing the original packet in the transmit queue of the target network interface. These two steps are performed synchronously.
3. There’s a major problem here: at this point, the image data rate far exceeds the network interface’s throughput. A large number of packets are piling up in the send queue—before the old ones can be sent, new ones keep arriving. Even if the buffer is extremely large, it can’t withstand this kind of load (the buffer only releases the corresponding data after it has been sent). Once the buffer is full, subsequent packets are dropped before they even reach the first stage—the kernel protocol stack—so they never make it to the loopback-copy stage.

Here’s also why it runs normally when the wired network port isn’t connected. When only a wireless network adapter is available, CycloneDDS enables multicast on the wireless adapter only for node discovery, while application data is transmitted via unicast.

## Solution

```bash
export CYCLONEDDS_URI='<CycloneDDS><Domain Id="any"><General><AllowMulticast>spdp</AllowMulticast></General></Domain></CycloneDDS>'
```

`AllowMulticast`Value Description

| Value      | Behavior and Notes                                                              |
| :------ | :------------------------------------------------------------------- |
|`true`| Allow multicast for discovery and user data; whether it is actually used also depends on the interfaces and peers. On bandwidth-constrained networks, check the transport path for large-data topics such as images.           |
|`false`| Disable the multicast controlled by this configuration. The default multicast discovery path is unavailable; this can be done via`Peers`Wait for the unicast discovery configuration to establish a connection; it cannot be generalized as “node discovery completely fails for all nodes.” |
|`spdp`| Retain multicast only for SPDP participant discovery; use unicast for endpoint matching and application data. In this case, it preserves convenient node discovery while avoiding sending image-data multicast traffic to the 100 Mbps interface.    |

## Appendix

### Theoretical Calculations

| Image stream | Resolution | Pixel encoding | Per-frame data size | Theoretical bandwidth at 30 Hz |
| :--- | :--------- | :--------------------- | :-----: | :-------------: |
| RGB | 1280 × 720 | RGB8 (3 B/pixel) | 2.76 MB |**663.55 Mbps**|
| Native depth | 848 × 480  | Z16 / 16UC1 (2 B/pixel) | 0.81 MB |**195.38 Mbps**|
| Aligned depth | 1280 × 720 | 16UC1 (2 B/pixel)       | 1.84 MB |**442.37 Mbps**|

### Introduction to DDS

![ROS 2 Communication Layers and Intra-Process Path](https://img.muelsyse.us/bed/paper-20261110-ros-layers-24212fd3eca3.png)

*Figure 5: The communication layers of ROS 2 client libraries, RMW, and DDS. In-process paths that meet the requirements can bypass DDS serialization.*

DDS (Data Distribution Service) is a distributed data communication standard published by OMG. ROS 2 typically relies on DDS to provide capabilities such as discovery, publish-subscribe, and QoS, organizes communication through Topics and data types, and uses**RMW (ROS Middleware Interface)**By separating the client API from the specific middleware implementation, implementations can be switched within the scope supported by the adaptation interface. Compared with the centralized Master-based discovery commonly used in ROS 1, DDS can establish connections between endpoints through distributed discovery (however, ROS 1’s Master is not the forwarding hub for all application data either; after nodes establish a connection, application data is usually transmitted directly, so a Master failure should not be equated with all existing data connections being immediately severed). DDS implementations commonly interoperate via RTPS. UDP/IP is a common transport, but the DDS standard does not permit only this one form of transport.
### ROS 2 component

ROS 2 components compile node implementations into dynamically loadable libraries, which are loaded by a component container within the same process. This provides a shared address space, making it easier to organize nodes. Nodes that continuously process large messages, such as camera publishers, image preprocessing, and YOLO inference, are well suited to being placed in the same container;**However, componentization and intra-process communication are two related but distinct configuration points. In addition to placing the nodes together, you also need to enable it for the relevant nodes.`use_intra_process_comms`, and confirm that the message and QoS support this path.**