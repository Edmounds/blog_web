---
createdAt: 2026-10-21T00:00:00.000Z
description: A deep-dive debugging story about a depth camera stream dropping out
title: ROS 2 Cyclone DDS Multicast Causes Camera Depth Stream Dropouts
published: true
tags:
  - ros2
  - realsense
  - mid360
  - DDS
  - Cyclone
slug: 20261021-01
---

## Case Review

### Background

Allow me to introduce the two suspects:

- MID-360 LiDAR | Wired Ethernet port, negotiated link speed of 100 Mbps
- Intel RealSense D435if depth camera | USB 3.0

In an earlier ROS 2 Humble project, I ran into intermittent failures where Actions and Services wouldn’t respond: the task state machine couldn’t get a Goal Handle, and the competition process would grind to a halt. To work around this, I switched ROS 2’s DDS middleware from the default Fast DDS to Cyclone DDS. I also compiled the camera driver and YOLO inference nodes as ROS 2 Components and loaded them into the same component container process to reduce the overhead of moving images around.

### The Trouble Begins

Everything had been working fine in testing, and I’d even finished the first version the day before we left. Based on our test results, we thought we had a real shot at first place nationally. We were already celebrating, thinking we’d finally broken the curse of always finishing projects right up against the deadline. Unfortunately, we celebrated too soon. Trouble was still on its way.

The workflow was nearly optimized, so I decided to make a change to our competition debugging tool. To make it easier to view the camera feed on-site, I overhauled the video streaming component in a web-based debugging page I’d built earlier. It was a bit like RViz. To keep latency low and control the bitrate, I chose WebRTC: a standalone Server node on the ROS 2 side subscribed to the camera’s RGB and depth images, encoded the frames for display as H.264, and sent them to my computer over WebRTC. In isolation, it worked as expected. But the problem was hiding in the word “standalone”: I’d added a cross-process subscriber outside the Component container. The local path from the camera to YOLO was still there, but the publisher now also had to deliver raw images to this new process over DDS. Since WebRTC compression only happened after the images arrived, it couldn’t help with that earlier transfer.

### DEBUG

Four hours before we were due to leave, all the trouble we’d set ourselves up for came to a head. After finishing the debugging tool, I was ready to run through the whole workflow again. The car moved, but it couldn’t recognize a single target. I checked the logs and saw that the YOLO inference node hadn’t even started inferring properly.

“Okay, let’s restart the process. There’s probably a 90% chance that’ll fix it.”

Nope. Still broken.

“Fine, I’ll ask AI.”

The AI looked at the logs and said the depth data had appeared briefly before dropping out, suggesting that the camera cable was loose. I breathed a sigh of relief. A loose cable was easy to fix—all I had to do was unplug it and plug it back in. Nope. Still no luck. I tried another cable, another USB port, and even another Thunderbolt port, but nothing worked. I also tried gemini-3.8-flash, gpt-6.1-sol, and gpt-6-astra one after another. None of them spotted the problem; instead, they started making random changes to the existing code, and at one point even the RGB feed disappeared.

With only an hour left before we had to leave and the problem still unsolved, I had no choice but to `git reset` back to the code that had worked the day before. I thought that if the old version ran, it would prove the hardware was fine. But it still wouldn’t run. I found out later that the WebRTC companion node was in a different workspace, so rolling back hadn’t touched it at all. At the time, though, I didn’t know that. I really thought the sky was falling. A software problem might still be fixable; if the hardware was broken, we were out of luck. There wasn’t a second camera to try, so all we could do was start packing. “Come on, let’s go. Here we are again: ‘Teacher, we have a video of it working.’”

I was exhausted on the way to the airport, but couldn’t sleep. The elevated highway was eerily empty at five in the morning. Streetlights stretched into a line through the pre-dawn darkness. Nobody spoke, and there was no car left to tinker with. I could only sit there, unable to touch anything or change anything. The frantic anxiety that had nearly driven me mad in those last few hours before we left slowly began to fade in the silence. I’d been rushing to put out the fire by restarting things, swapping cables, and asking AI for help, hoping to get lucky and fix it in the next second, but I hadn’t even done the basic work of changing one variable at a time.

“I can’t keep relying on that dumb lucky AI.” First, I needed to check RGB and depth separately in `realsense-viewer` and rule out ROS.

When we reached the gate, boarding was still half an hour away. I hurriedly connected the battery to the car to test it, and finally got some good news: when I viewed the camera on its own, both RGB and depth worked normally. That meant the hardware was fine. It was a software problem, so there was still hope.

At the hotel, the room was too cramped to run the whole workflow, so I started only the camera and inference nodes. I left the LiDAR and lower-level controller off. Huh—the camera was working normally, with both depth and RGB coming through. I still hadn’t realized that the LiDAR was the difference, since it had always been on during our pre-departure testing. So I celebrated too early again, thinking it must be some kind of mysterious fluke. Since it was working, I decided not to touch anything and got some sleep before the on-site debugging session that afternoon.

But as soon as we ran the full workflow at the venue, the camera went down again, and the depth stream dropped out as before. That’s when I remembered that I hadn’t turned on the LiDAR or the lower-level controller at lunchtime. I compared things one by one, and finally narrowed it down: whenever the LiDAR was powered on and connected to the mini PC, the camera’s depth stream would drop out. I told gemini-3.8-flash what I’d found, and Gemini went into panic mode again, suggesting that the LiDAR’s infrared light might be interfering with the camera. I thought it was possible: we had changed the arm’s initial position that day, so the LiDAR might have been scanning the camera. The D435 series uses active stereo depth and also has an infrared projector, so optical interference was worth checking. We raised the camera and tested again with the LiDAR covered by hand, but the stream still dropped out. It wasn’t until I asked gpt-6.1-sol to analyze the logs that we finally started looking at the network: even though the camera was connected over USB, that didn’t mean ROS image data traveled only over USB. The raw cross-process image traffic could be passing through the LiDAR’s 100 Mbps wired interface. After we restricted DDS’s user-data multicast, depth came back and the network port’s transmit rate dropped significantly. That finally pinned the problem on the communication configuration.

## Root Cause and How the Data Travels

### Analysis

The strongest evidence on-site was the link between the failure, the wired interface, and the DDS multicast policy: the stream dropped out when the LiDAR network was connected, recovered after setting `AllowMulticast` to `spdp`, and the physical interface’s transmit rate fell from around 100 Mbps to 0.003 Mbps. This supports the explanation that **high-bandwidth image data was being sent as DDS data multicast over the 100 Mbps link, causing network congestion**.

I didn’t run into a problem immediately after switching to Cyclone DDS because the communication topology was relatively simple at the time: the camera and YOLO were in the same container process, and with the right configuration they could communicate in-process. Later, when I added the WebRTC node in a separate process, it needed to receive raw images through RMW/DDS, adding another high-bandwidth transfer path. (The original in-process path wasn’t disabled.) Cyclone DDS chooses network paths based on interface capabilities, configuration, and discovered peers. In the on-site logs, the wireless interface showed `presumed flaky multicast, use for SPDP only`, while the wired interface showed `presumed robust multicast support, use for everything`. This reflects its default assessment of multicast support on each interface: wireless interfaces tend to be used only for discovery multicast, while wired interfaces may be used more broadly. It does not mean that “all wired interfaces will carry all traffic.” The actual choice also depends on the version, configuration, and subscription topology. The problem was that an interface allowed to carry data multicast doesn’t necessarily have enough bandwidth. A 1280 × 720 RGB8 image published at 30 Hz has a pixel payload of about 664 Mbps alone—far beyond the capacity of this 100 Mbps link, so it was bound to get stuck.

![ROS 2 Image Communication on the Same Host and Multicast Policies](https://img.muelsyse.us/bed/paper-20261110-ros-data-path-4c6bb401b377.png)

*Figure 2: An external subscriber adds a DDS image transfer path. After switching to `spdp`, multicast is used only for participant discovery, while endpoint matching and image transfer use unicast. Same-host destination addresses are usually delivered via local routing; remote subscribers still require the physical network.*

> Here’s another counterintuitive point: if the data has already arrived at the same computer over USB, why would it affect the physical network port? Because cross-process communication doesn’t automatically mean shared-memory communication. The DDS network path used here serializes the images and sends them through the UDP/IP stack. Unicast to a local address is usually delivered via local routing on Linux; data multicast can generate both traffic on a physical interface and local loopback delivery.

## Solution

The fix that worked was to restrict Cyclone DDS multicast to the participant discovery stage, so that endpoint matching and user data use unicast. Set this in the terminal where you start the ROS nodes:

```bash
export CYCLONEDDS_URI='<CycloneDDS><Domain Id="any"><General><AllowMulticast>spdp</AllowMulticast></General></Domain></CycloneDDS>'
```

You can also add it to `~/.bashrc` or `~/.zshrc`, then reload the configuration before starting the relevant nodes. Already-running processes won’t automatically pick up the new environment variable, so they need to be restarted. If the nodes are managed by systemd, a container, or another launcher, pass the variable through that launch environment as well.

`AllowMulticast` values

| Value   | Behavior and notes |
| :------ | :------------------------------------------------------------------- |
| `true`  | Allows multicast for discovery and user data; whether it is actually used also depends on the interfaces and peers. On bandwidth-constrained networks, check the transfer paths for high-bandwidth topics such as images. |
| `false` | Disables the multicast controlled by this setting. The default multicast discovery path is unavailable, but contact can be established through unicast discovery configuration such as `Peers`; this does not mean that “discovery for all nodes stops working entirely.” |
| `spdp`  | Keeps multicast only for SPDP participant discovery; endpoint matching and user data use unicast. In this case, it preserved convenient node discovery while avoiding image data multicast over the 100 Mbps interface. |

## Appendix

### Theoretical Calculations

#### Image Payload and 100 Mbps Bandwidth Limit

A useful clue at the time was that the RGB receive rate was only about 4.4 Hz. Working backward from the size of a single frame, its payload throughput was already close to 100 Mbps. The physical network port had also negotiated a rate of exactly 100 Mbps. This was consistent with the link being the bottleneck, though the calculation alone cannot replace packet capture or interface counters.

| Image stream | Resolution | Pixel encoding | Data per frame | Theoretical bandwidth at 30 Hz |
| :--- | :--- | :--- | :---: | :---: |
| RGB | 1280 × 720 | RGB8 (3 B/pixel) | 2.76 MB | **663.55 Mbps** |
| Native depth | 848 × 480 | Z16 / 16UC1 (2 B/pixel) | 0.81 MB | **195.38 Mbps** |
| Aligned depth | 1280 × 720 | 16UC1 (2 B/pixel) | 1.84 MB | **442.37 Mbps** |

The mini PC’s network port and the LiDAR had negotiated an actual link speed of **100 Mbps full duplex**. Full duplex means that data can be transmitted in both directions at the same time; it does not raise the limit in one direction to 200 Mbps. In the ideal case, without accounting for any protocol overhead, the maximum it can handle in one direction is:

$$100,000,000 \text{ bps} \div (1280 \times 720 \times 3 \times 8 \text{ bits}) \approx 4.52 \text{ fps}$$

The RGB receive rate on-site was **4.4 Hz**, equivalent to a pixel payload of about **97.3 Mbps**, close to this theoretical limit.

#### Comparison with Measured Data

| Metric | Before fix | After fix |
| :--- | :---: | :---: |
| **Color image update rate** | 4.4 Hz | 13.9 Hz |
| **Native depth update rate** | 0 Hz | 29.7 Hz |
| **Aligned depth update rate** | 0 Hz | 14.2 Hz |
| **RGBD heartbeat rate** | 0 Hz | 14.1 Hz |
| **Median color image receive latency** | 943.9 ms | 58.3 ms |
| **Median native depth receive latency** | N/A | 42.1 ms |
| **Physical wired port transmit rate** | About 100 Mbps | **0.003 Mbps** |

Restoring communication doesn’t mean every stream is running at 30 Hz: native depth recovered to 29.7 Hz, but RGB, aligned depth, and the RGBD heartbeat were still around 14 Hz. This shows that the dropouts were alleviated; it doesn’t prove that the entire vision processing pipeline is free of other bottlenecks.

### Introduction to DDS

![ROS 2 Communication Layers and the In-Process Path](https://img.muelsyse.us/bed/paper-20261110-ros-layers-24212fd3eca3.png)

*Figure 5: The ROS 2 communication layers: client library, RMW, and DDS. An eligible in-process path can bypass DDS serialization; whether cross-process communication uses the network or shared memory depends on the implementation and configuration.*

DDS (Data Distribution Service) is a distributed data communication standard published by the OMG. ROS 2 typically relies on DDS for capabilities such as discovery, publish-subscribe, and QoS, organizing communication through Topics and data types. It uses **RMW (ROS Middleware Interface)** to separate the client API from the specific middleware implementation, allowing implementations to be switched within the limits of the supported interface. Unlike the centralized Master-based discovery commonly used in ROS 1, DDS can establish endpoint connections through distributed discovery. (However, the ROS 1 Master is not a relay for all user data either: after nodes establish a connection, user data is usually transferred directly, so a Master failure should not be equated with all existing data connections immediately dropping.) DDS implementations often interoperate through RTPS. UDP/IP is a common transport, but the DDS standard does not permit only this one transport.

### Fast DDS vs Cyclone DDS

The table below covers only the differences relevant to this issue; it does not attempt to assign absolute use cases to the two implementations based on this one on-site experience.

| Evaluation area | Fast DDS | Cyclone DDS |
| :--- | :--- | :--- |
| Shared memory | Supports mechanisms such as shared-memory transport and data sharing. Whether they are enabled, or reduce serialization or copying, depends on the version, configuration, and message conditions. | Support depends on the version, build, and configuration; this article does not assume that “same-host communication” means shared memory is enabled. |
| Network interfaces and multicast | Network transport, discovery, and multicast behavior can be configured; check which configuration is actually in effect. | Offers interface selection and multicast policy configuration; this time, `AllowMulticast=spdp` avoided user-data multicast. |
| Behavior observed in this project | We had previously encountered unresponsive Actions / Services, but didn’t retain enough information to confirm the specific mechanism. | Dropouts occurred after adding an external image subscriber and a 100 Mbps wired interface; they stopped after restricting user-data multicast. |
| Selection and validation | Validate functionality, QoS, load, and fault recovery on the specific version in use. | Likewise, validate with the full node topology and actual network conditions; testing a single node isn’t enough. |

### ROS 2 Components

ROS 2 Components compile node implementations into dynamically loadable libraries, which a component container loads into the same process. This gives them a shared address space, making it easier to organize nodes and creating opportunities to reduce image copying. However, how the container schedules callbacks also depends on the executor, so it’s not always accurate to say that components “share one thread pool.” Nodes that continuously process large messages—such as camera publishers, image preprocessing, and YOLO inference—are good candidates for checking whether they can be placed in the same container. However, **componentization and in-process communication are two related but distinct configuration points**. In addition to placing the nodes together, you also need to enable `use_intra_process_comms` for the relevant nodes and confirm that the messages and QoS support this path.

#### How Componentization Can Improve Performance

When the conditions for in-process communication are met, messages can be delivered to local subscribers by transferring ownership of or sharing C++ objects, reducing two kinds of overhead:

1. **Message copying**: With compatible publisher and subscriber interfaces, a `std::unique_ptr` or a shared read-only message can be transferred. Whether copying is still required depends on the number of subscribers, callback signatures, and buffering strategy.
2. **Serialization**: Local in-process delivery can bypass DDS serialization and deserialization. If there are external subscribers too, the publisher still needs to prepare a middleware message for the external path.

So, “turn on Components and you get completely zero-copy” is not true. To verify the actual effect, you can use the ROS 2 in-process communication example to check message addresses, then measure CPU usage, memory bandwidth, and end-to-end latency under a real workload.

### Unicast

Unicast sends data to a specific destination address. In the same-host scenario described here, data sent to a local address can usually be delivered via local routing, while data sent to a remote host still needs the physical link. Unicast doesn’t automatically guarantee high throughput or low latency. If there are many remote subscribers and data must be sent to each one separately, total traffic may actually increase. In this case, the benefit came from preventing high-bandwidth user-data multicast from entering a constrained interface.

### Multicast

IPv4 multicast uses addresses in the `224.0.0.0` to `239.255.255.255` range. A sender transmits data to a multicast group, and network devices handle it according to their multicast forwarding configuration. Receivers get the data by joining the multicast group. Whether a switch forwards traffic only to ports with members also depends on features such as IGMP snooping. If these features aren’t enabled or are misconfigured, traffic may be flooded to more ports. Multicast is useful for one-to-many transmission, but it is still constrained by link bandwidth, wireless conditions, and endpoint implementations.

References:

- [ROS 2 Humble: Setting up efficient intra-process communication](https://docs.ros.org/en/humble/Tutorials/Demos/Intra-Process-Communication.html)
- [ROS 2: Intra-process communication design](https://design.ros2.org/articles/intraprocess_communications.html)
- [Cyclone DDS 0.10.5: Implementation features and data transmission](https://cyclonedds.io/docs/cyclonedds/0.10.5/config/cyclonedds_specifics.html)
- [Cyclone DDS: Multicast configuration](https://cyclonedds.io/docs/cyclonedds/latest/config/multicasting.html) (current documentation; options depend on the installed version)