---
title: Router Optimization Strategies in Multi-AP Environments
description: In competition venues such as Robocon, where interference is heavy and network conditions are complex, appropriately balancing the router's channel and bandwidth based on an on-site spectrum scan
createdAt: 2026-10-23T00:00:00.000Z
tags:
  - Networking
  - Routers
  - Optimization
published: true
slug: 20261023-01
---

## Introduction

At robot competition venues such as Robocon, the network environment is often extremely complex.

At the time, my router was using the factory-default 80 MHz bandwidth, which happened to fall within the most congested frequency range. This directly caused severe stuttering in the WebRTC video stream, with latency at one point soaring above 1 second.

An on-site scan of the surrounding wireless environment detected a total of 88 actively transmitting Wi-Fi signals:

![Spectrum scan from the competition venue](https://img.muelsyse.us/bed/20261025165234244.png)

The spectrum scan shows that a large number of devices were crowded into the same channel and bandwidth ranges. Even without understanding the underlying principles of radio communication, common sense tells us that when too many cars use the same lane, traffic jams occur. Wi-Fi works the same way: choosing a lane with fewer cars should make things faster. And that is indeed what happens in practice. We only need to switch the router to a suitable bandwidth and channel to greatly improve the stability and speed of our Wi-Fi.

Here, I would like to analyze the causes of Wi-Fi stuttering from the perspective of underlying radio principles. This also serves as my own set of study notes for learning about communications.

---

## Why Does Wi-Fi Stutter?

### 1. Channel Contention and the Backoff Mechanism (CSMA/CA)

Wi-Fi uses the half-duplex CSMA/CA mechanism. Before transmitting data, a device must perform carrier sensing.

When it detects an in-band electromagnetic signal above the threshold (typically $-62 \text{ dBm} \sim -82 \text{ dBm}$), the device determines that the channel is busy and enters a random backoff period. In an environment where dozens of devices compete for access in turn, packets build up in severe queues, resulting in noticeable network latency and jitter.

### 2. Probability of Collisions from Multi-Channel Bonding

Home routers typically use a factory-default bandwidth of 80 MHz, formed by bonding four consecutive independent 20 MHz channels (see [Bandwidth and Channel Bonding](#频宽与信道绑定)). Most phones' 5 GHz hotspots are also hard-coded to channels 149 or 153.

The prerequisite for a device to transmit an 80 MHz packet is that all four bonded 20 MHz channels must be idle at the same time.

Let the probability that an individual channel is occupied by nearby devices be $p$. The joint probability that an 80 MHz channel can successfully transmit a packet is only $(1-p)^4$. In a dense Wi-Fi environment, the probability that all four channels are idle simultaneously approaches zero.

### 3. Strong Co-Channel Interference and Modulation Downgrading

The stronger the surrounding interference signals, the lower the signal-to-interference-plus-noise ratio (see [Signal-to-Interference-plus-Noise Ratio (SINR)](#信干噪比-sinr)).

According to Shannon's theorem (see [Shannon's Theorem](#香农定理)), channel capacity in a dense environment shrinks drastically as $\text{SINR}$ plummets. The high transmission rates advertised for Wi-Fi 6 rely on 1024-QAM modulation, which requires $\text{SINR} \ge 35 \text{ dB}$ (see [QAM Modulation](#qam-调制)).

When $\text{SINR}$ falls below the threshold, the wireless chip can only automatically fall back to a lower-order modulation, causing the transmission bandwidth to drop sharply.

---

## Solution: Balancing Channels and Bandwidth On Site

### 1. Reduce Bandwidth to Improve Interference Resistance

In high-interference environments, blindly choosing a wider bandwidth can be counterproductive. According to the thermal-noise formula (see [Thermal Noise Floor Formula](#热噪声底噪公式)), when bandwidth increases from 20 MHz to 80 MHz, the physical noise floor increases by:

$$\Delta N = 10 \log_{10}(4) \approx 6 \text{ dB}$$

Doubling the bandwidth physically raises the signal-to-noise ratio threshold required for the device to receive signals, significantly reducing overall resistance to interference.

### 2. Spectrum Scanning and Avoidance Principles

In a complex network environment, first use a spectrum-scanning tool to collect the status of surrounding signals:

- Received signal strength (RSSI)
- Operating channel
- Operating bandwidth

The core principle for channel selection is to avoid congested channels and interference sources with high transmission power. In general, it is necessary to proactively avoid frequency ranges occupied by APs with signal strengths greater than $-60 \text{ dBm}$.

### 3. On-Site Tuning in Practice

Analysis of the spectrum scan above showed that the default 80 MHz bandwidth had severe overlap with other signals. By contrast, channel 165 and channels 52 through 64 were not only relatively clear but also free of high-power interference signals.

In mainland China, channels 52 through 64 belong to the DFS (Dynamic Frequency Selection) band. Most phone hotspots lack radar-avoidance certification, so the system firmware is legally restricted from transmitting hotspots in this band. As a result, hotspot interference is rarely found in this region.

Channel 165 is suitable for operation at 20 MHz bandwidth, allowing us to sacrifice peak speed in exchange for extremely high transmission stability.

At the time, I switched to channels 52 and 56 and set the bandwidth to 40 MHz. After the switch, the WebRTC video stream immediately became smooth again, latency returned to normal, and the connection drops disappeared completely.

---

## Appendix: General Wi-Fi Theory

### AP

AP (Access Point) is the wireless access point. It is the RF transmission hub that connects a wired local area network to wireless terminals such as phones.

Home wireless routers typically integrate AP transmission, network routing, and switching functions.

### Frequency Bands

#### 2.4 GHz

- The frequency range is typically 2400 MHz to 2483.5 MHz.
- It has lower frequencies, longer wavelengths, and better wall penetration, but slower transmission speeds. Common devices include Bluetooth, wireless mice, and smart-home terminals.

#### 5 GHz

- The total available contiguous spectrum spans several hundred MHz. Common bands include 5150 to 5350 MHz and 5725 to 5850 MHz.
- It has higher frequencies, shorter wavelengths, and greater attenuation through walls. Its main advantage is its extremely high transmission speed.

### Channel Allocation

Communication protocols divide the continuous spectrum into discrete center frequencies at fixed intervals. Each designated frequency point and the physical bandwidth it occupies are collectively referred to as a channel.

Adjacent channel numbers are spaced 5 MHz apart, while the Wi-Fi standard defines the physical spectral width of an individual channel as 20 MHz.

To prevent adjacent channels from overlapping within the 5 GHz band, channel numbers must be separated by four units, such as 36, 40, 44, and 48, or 149, 153, 157, and 161.

### Bandwidth and Channel Bonding

Common Wi-Fi bandwidths include 20 MHz, 40 MHz, 80 MHz, and 160 MHz.

#### 20 MHz

Taking 802.11ac as an example, a 20 MHz physical channel is divided into 64 subcarriers, including 52 effective data subcarriers responsible for carrying data packets.

#### 40 MHz / 80 MHz / 160 MHz

Wider bandwidths use channel bonding. Taking 80 MHz as an example, the RF and baseband systems concatenate four consecutive 20 MHz channels, such as 149, 153, 157, and 161, at the underlying level. According to Shannon's theorem, channel capacity increases as bandwidth expands.

When bonding multiple channels, the router must designate one of them as the primary channel. The router's management frames are transmitted over the primary channel using a 20 MHz bandwidth, ensuring that older devices can still connect with normal compatibility.

### Shannon's Theorem

$$C = B \cdot \log_2 \left( 1 + \frac{S}{N + I} \right)$$

- $C$: Maximum channel transmission rate
- $B$: Physical bandwidth
- $S$: Received useful-signal power
- $N$: Ambient background thermal noise
- $I$: Co-channel interference power

### Thermal Noise Floor Formula

$$N = k \cdot T \cdot B \implies N \propto 10 \log_{10}(B) \quad (\text{dBm})$$

- $B$: Physical bandwidth
- $N$: Physical background thermal noise

Increase in the noise floor when bandwidth increases by a multiple:

$$\Delta N = 10 \log_{10}\left(\frac{B_2}{B_1}\right)$$

Each time the bandwidth doubles, the background thermal noise received by the device necessarily increases physically by $3\text{ dB}$.

### Signal-to-Interference-plus-Noise Ratio (SINR)

- **SNR** (signal-to-noise ratio): $\text{SNR} = \frac{S}{N}$
- **SINR** (signal-to-interference-plus-noise ratio): $\text{SINR} = \frac{S}{N + I}$

$$\text{SINR}_{(\text{dB})} \approx P_{\text{自身信号}}(\text{dBm}) - P_{\text{相邻干扰}}(\text{dBm})$$

- $P_{\text{自身信号}}$: Received signal strength (RSSI) of the local router
- $P_{\text{相邻干扰}}$: Signal strength of nearby interference sources on the same channel

### QAM Modulation

Traditional modulation methods use one-dimensional level switching or phase reversal, transmitting only 1 bit at a time.

QAM modulation divides the amplitude and phase of orthogonal electromagnetic waves into a two-dimensional constellation grid. The receiver distinguishes the grid states to decode multiple bits simultaneously.

| Modulation | Data Payload per Subcarrier | Required SINR Threshold |
| :--- | :--- | :--- |
| 1024-QAM (Wi-Fi 6 top-tier configuration) | 10 bit | $\ge 35 \text{ dB}$ |
| 256-QAM (Wi-Fi 5 standard configuration) | 8 bit | $\ge 28 \text{ dB}$ |
| 64-QAM | 6 bit | $\ge 22 \text{ dB}$ |
| 16-QAM | 4 bit | $\ge 15 \text{ dB}$ |
| QPSK (fallback mode) | 2 bit | $\approx 6 \sim 10 \text{ dB}$ |