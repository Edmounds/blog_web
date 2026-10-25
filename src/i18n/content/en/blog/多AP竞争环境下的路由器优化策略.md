---
title: Router Optimization Strategies in Environments with Multiple Competing APs
description: At events like Robocon, where interference is abundant and network conditions are complex, use on-site spectrum scans to strike an appropriate balance between router channels and bandwidth
createdAt: 2026-10-23T00:00:00.000Z
tags:
  - Networking
  - Routers
  - Optimization
published: true
slug: 20261023-01
---

## Introduction

At robotics competitions such as Robocon, network conditions are often extremely complex.

At the time, my router was using its factory-default 80 MHz bandwidth, which happened to fall in the most crowded part of the spectrum. This caused severe stuttering in WebRTC video streams, with latency at one point rising above 1 second.

A scan of the wireless environment at the venue found 88 Wi-Fi signals actively transmitting:

![Spectrum scan at the competition](https://img.muelsyse.us/bed/20261025165234244.png)

The scan results show that a large number of devices were clustered in the same channel and bandwidth ranges. Even without knowing the underlying principles of radio communications, we can intuitively see that too many cars on the same lane cause a traffic jam. Wi-Fi is no different: choosing a lane with fewer cars should get you there faster. And that’s exactly what happened. Simply switching the router to a suitable bandwidth and channel can greatly improve Wi-Fi stability and speed.

Here, I want to start from the underlying principles of radio communications and analyze why Wi-Fi stutters. This is also a set of study notes for my own learning about communications.

---

## Why Does Wi-Fi Stutter?

### 1. Channel Contention and Backoff (CSMA/CA)
Wi-Fi uses the half-duplex CSMA/CA mechanism. Before sending data, a device must perform carrier sensing.

When it detects an electromagnetic signal on the same frequency above a threshold (usually $-62 \text{ dBm} \sim -82 \text{ dBm}$), the device considers the channel busy and is forced to back off for a random period. When dozens of devices take turns competing for access, packets build up in queues, causing noticeable network latency and jitter.

### 2. Probability of Conflicts with Multiple Bound Channels
Home routers typically come with a factory-default bandwidth of 80 MHz, created by bonding 4 consecutive, independent 20 MHz channels (see [Bandwidth and Channel Bonding](#频宽与信道绑定)). Most phones also hard-code their 5 GHz hotspots to channel 149 or 153.

To send an 80 MHz packet, all 4 of the bonded 20 MHz channels must be idle at the same time.

Let $p$ be the probability that a single channel is occupied by nearby devices. Then the combined probability of successfully sending a packet over 80 MHz is only $(1-p)^4$. In a crowded Wi-Fi environment, the probability that all 4 channels are idle at once approaches zero.

### 3. Strong Co-Channel Interference and Modulation Downgrade
The stronger the interference signals nearby, the lower the signal-to-interference-plus-noise ratio (see [Signal-to-Interference-plus-Noise Ratio (SINR)](#信干噪比-sinr)).

According to Shannon’s theorem (see [Shannon’s Theorem](#香农定理)), channel capacity in a dense environment drops sharply as $\text{SINR}$ falls. The high data rates advertised for Wi-Fi 6 rely on 1024-QAM modulation, which requires $\text{SINR} \ge 35 \text{ dB}$ (see [QAM Modulation](#qam-调制)).

When $\text{SINR}$ falls below the threshold, the wireless chip can only automatically fall back to a lower-order modulation scheme, causing a dramatic drop in transmission bandwidth.

---

## Solution: Balancing Channels and Bandwidth On-Site

### 1. Reduce Bandwidth to Improve the Baseline Resistance to Interference
Blindly choosing higher bandwidth in a high-interference environment can backfire. According to the thermal noise formula (see [Thermal Noise Floor Formula](#热噪声底噪公式)), increasing bandwidth from 20 MHz to 80 MHz physically raises the background noise floor by:

$$\Delta N = 10 \log_{10}(4) \approx 6 \text{ dB}$$

Doubling the bandwidth physically raises the signal-to-noise threshold required by the receiving device, significantly reducing its overall resistance to interference.

### 2. Spectrum Scanning and Avoidance
In a complex network environment, first use a spectrum scanning tool to collect information about nearby signals:
- Received signal strength (RSSI)
- Operating channel
- Operating bandwidth

The core principle for choosing a channel is to avoid crowded channels and interference sources transmitting at high power. In general, you should proactively avoid frequency ranges occupied by APs with signal strengths above $-60 \text{ dBm}$.

### 3. On-Site Tuning in Practice
An analysis of the scan results above shows that the default 80 MHz bandwidth range was heavily congested. By contrast, channel 165 and channels 52 through 64 were not only clear, but also free of high-power interference signals.

In mainland China, channels 52 through 64 are in the DFS (Dynamic Frequency Selection) band. Since most phone hotspots lack radar avoidance certification, regulations prevent them from transmitting hotspots in this band at the system level. As a result, this range rarely experiences interference from hotspots.

Channel 165 is suitable for operation at 20 MHz bandwidth, sacrificing peak speed in exchange for very high transmission stability.

At the time, I switched to channels 52 and 56, with the bandwidth set to 40 MHz. As soon as the change was complete, the WebRTC video stream returned to smooth playback, latency dropped to normal levels, and interruptions disappeared entirely.

---

## Appendix: Wi-Fi Fundamentals

### AP
AP stands for Access Point. It is the radio transmission hub that connects a wired local area network to wireless clients such as phones.

Home wireless routers typically integrate an AP transmitter, network routing, and switching functions.

### Frequency Bands
#### 2.4 GHz
- The frequency range is typically 2400 MHz to 2483.5 MHz.
- Lower frequency and longer wavelength provide better wall penetration, but transmission speeds are slower. Common devices include Bluetooth devices, wireless mice, and smart home devices.

#### 5 GHz
- The total available continuous spectrum spans several hundred MHz, with common bands covering 5150 to 5350 MHz and 5725 to 5850 MHz.
- Higher frequency and shorter wavelength mean greater attenuation through walls. The main advantage is very high transmission speed.

### Channel Allocation
Communication protocols divide continuous spectrum into discrete center frequencies at fixed intervals. Each designated frequency, along with the physical bandwidth it occupies, is collectively referred to as a channel.

Adjacent channel numbers are 5 MHz apart, while the Wi-Fi standard defines the physical spectrum width of a single channel as 20 MHz.

To prevent adjacent channels from overlapping in the 5 GHz band, channel numbers must be separated by 4 (for example, 36, 40, 44, and 48; or 149, 153, 157, and 161).

### Bandwidth and Channel Bonding
Common Wi-Fi bandwidths include 20 MHz, 40 MHz, 80 MHz, and 160 MHz.

#### 20 MHz
Taking 802.11ac as an example, a 20 MHz physical channel is divided into 64 subcarriers, of which 52 are effective data carriers used to carry packets.

#### 40 MHz / 80 MHz / 160 MHz
Higher bandwidths use channel bonding. For example, with 80 MHz, the radio-frequency and baseband layers combine 4 consecutive 20 MHz channels (such as 149, 153, 157, and 161). According to Shannon’s theorem, channel capacity increases as bandwidth expands.

When bonding multiple channels, the router must designate one of them as the primary channel. The router’s management frames are transmitted on the primary channel at a bandwidth of just 20 MHz, ensuring that older devices can still connect and operate normally.

### Shannon’s Theorem

$$C = B \cdot \log_2 \left( 1 + \frac{S}{N + I} \right)$$

- $C$: Maximum channel transmission rate
- $B$: Physical bandwidth
- $S$: Received power of the useful signal
- $N$: Ambient background thermal noise
- $I$: Co-channel interference power

### Thermal Noise Floor Formula

$$N = k \cdot T \cdot B \implies N \propto 10 \log_{10}(B) \quad (\text{dBm})$$

- $B$: Physical bandwidth
- $N$: Physical background thermal noise

Increase in the noise floor as bandwidth grows by a factor:

$$\Delta N = 10 \log_{10}\left(\frac{B_2}{B_1}\right)$$

Every time bandwidth doubles, the background thermal noise received by the device physically increases by $3\text{ dB}$.

### Signal-to-Interference-plus-Noise Ratio (SINR)

- **SNR** (signal-to-noise ratio): $\text{SNR} = \frac{S}{N}$
- **SINR** (signal-to-interference-plus-noise ratio): $\text{SINR} = \frac{S}{N + I}$

$$\text{SINR}_{(\text{dB})} \approx P_{\text{自身信号}}(\text{dBm}) - P_{\text{相邻干扰}}(\text{dBm})$$

- $P_{\text{自身信号}}$: Signal strength received by the local router (RSSI)
- $P_{\text{相邻干扰}}$: Signal strength of nearby co-channel interference sources

### QAM Modulation
Traditional modulation methods use a single dimension to switch levels or reverse phase, transmitting just 1 bit at a time.

QAM modulation divides the amplitude and phase of orthogonal electromagnetic waves into a two-dimensional constellation grid. The receiver determines the grid state to decode multiple bits simultaneously.

| Modulation scheme | Data payload per carrier | Required SINR threshold |
| :--- | :--- | :--- |
| 1024-QAM (Wi-Fi 6 top tier) | 10 bit | $\ge 35 \text{ dB}$ |
| 256-QAM (Wi-Fi 5 standard) | 8 bit | $\ge 28 \text{ dB}$ |
| 64-QAM | 6 bit | $\ge 22 \text{ dB}$ |
| 16-QAM | 4 bit | $\ge 15 \text{ dB}$ |
| QPSK (fallback mode) | 2 bit | $\approx 6 \sim 10 \text{ dB}$ |