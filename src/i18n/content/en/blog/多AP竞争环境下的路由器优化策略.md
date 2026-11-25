---
title: Router Optimization Strategies for Environments with Multiple Competing APs
description: In competition environments such as Robocon, where interference is heavy and the network environment is complex, make appropriate trade-offs when selecting the router’s channel and channel width based on an on-site spectrum scan.
createdAt: 2026-10-23T00:00:00.000Z
tags:
  - Network
  - Router
  - Optimization
  - Get to the bottom of things
published: true
slug: 20261023-01
---

## Introduction

At robotics competitions such as Robocon, network conditions are often extremely complex.

At the time, my router was using the factory-default 80 MHz channel width, which happened to overlap with the most congested frequency band. WebRTC video streaming suffered severe stuttering, and latency at one point spiked to over one second.

A scan of the wireless environment at the venue found 88 Wi-Fi signals actively transmitting:

![Spectrum scan at the competition](https://img.muelsyse.us/bed/20261025165234244.png)

The frequency scan results show that a large number of devices are clustered within the same channel and bandwidth ranges. Intuitively, it’s like having too many cars on the road: taking a less congested route might get you there faster. However, the scan list only shows which signals are nearby; it does not directly indicate channel utilization. I still need to switch the channel bandwidth and channel, then check whether the video latency improves.

Here, I’d like to analyze the causes of Wi-Fi lag from the perspective of radio principles, while also using this as notes for my own study of communications.

---

## Why Does Wi-Fi Stutter?

### 1. Channel Contention and Backoff (CSMA/CA)
Wi-Fi uses the half-duplex CSMA/CA mechanism. Before sending data, a device must perform carrier sensing.

Whether a channel is busy must be determined based on Wi‑Fi preamble detection, energy detection, and virtual carrier sensing; it cannot be characterized by a single fixed RSSI threshold. During contention, devices wait for the channel to become idle and perform random backoff. When many nearby devices are active, queuing, collisions, and retransmissions all increase latency and jitter.

### 2. Probability of Conflicts with Multiple Bound Channels
My router uses 80 MHz by default, formed by bonding four contiguous 20 MHz subchannels (see details in[Bandwidth and Channel Bonding](#频宽与信道绑定)). During on-site scanning, some hotspots are concentrated within similar channel ranges; the channels available to a hotspot also depend on the device and regional settings.

When transmitting over the full 80 MHz bandwidth, the protocol requires checking whether the primary and secondary channels are busy or idle. If the secondary channel is busy, devices that support dynamic bandwidth may switch to 40 MHz or 20 MHz transmission instead of waiting indefinitely.

For a simplified analysis, assume that each subchannel is occupied with the same probability $p$ and that the occupancy events are independent. Then, the probability that all four subchannels are idle simultaneously is $(1-p)^4$. In practice, occupancy is often correlated, and protocols also allow dynamic bandwidth reduction, so this equation only helps illustrate that wider channels are more likely to encounter occupancy; it cannot directly predict throughput in the field.

### 3. Strong Co-Channel Interference and Modulation Downgrade
The stronger the interference signals nearby, the lower the signal-to-interference-plus-noise ratio (see [Signal-to-Interference-plus-Noise Ratio (SINR)](#信干噪比-sinr)).

According to Shannon’s theorem (see [Shannon’s Theorem](#香农定理)), with the bandwidth unchanged, a lower $\text{SINR}$ corresponds to a lower theoretical capacity. Wi-Fi 6 can use higher-order modulation up to 1024-QAM, but this requires better signal quality; the specific threshold depends on the coding rate, receiver, and target packet error rate, and cannot be uniformly expressed as a fixed dB value (see[QAM Modulation](#qam-调制)).

When link quality deteriorates, rate control may select a lower modulation and coding scheme, while retransmissions may also increase, resulting in lower actual throughput.

---

## Solution: Balancing Channels and Bandwidth On-Site

### 1. Reduce Bandwidth to Improve the Baseline Resistance to Interference
Blindly choosing higher bandwidth in a high-interference environment can backfire. According to the thermal noise formula (see [Thermal Noise Floor Formula](#热噪声底噪公式)), increasing bandwidth from 20 MHz to 80 MHz physically raises the background noise floor by:

$$\Delta N = 10 \log_{10}(4) \approx 6 \text{ dB}$$

This compares the integrated thermal noise when the temperature and receiver conditions are the same and the total received signal power remains constant. An increase in noise power lowers the signal-to-noise ratio; if transmit power varies with bandwidth, the result will also differ. This does not mean that the modulation’s inherent signal-to-noise ratio threshold has been raised, nor does it by itself show that narrower bandwidth is necessarily faster.

### 2. Spectrum Scanning and Avoidance
In a complex network environment, first use a spectrum scanning tool to collect information about nearby signals:
- Received signal strength (RSSI)
- Operating channel
- Operating bandwidth

When selecting a channel, I first avoid APs with severe overlap and very strong received signals, then validate the choice through real-world load testing. RSSI strength cannot be directly equated with the other AP’s transmit power, nor is there a $-60 \text{ dBm}$ avoidance threshold that applies to every venue.

### 3. On-Site Tuning in Practice
An analysis of the scan results above shows that the default 80 MHz bandwidth range was heavily congested. By contrast, channel 165 and channels 52 through 64 were not only clear, but also free of high-power interference signals.

Channels 52–64 are subject to DFS (Dynamic Frequency Selection) requirements, meaning devices must detect and avoid radar in accordance with local regulations. Some devices do not make these channels available in hotspot mode, but scan results alone cannot establish that this is due to certification or legal restrictions. When selecting DFS channels, also consider the detection wait time, radar-triggered channel changes, and client compatibility.

With the configurations available on my equipment, channel 165 can operate at 20 MHz. It was relatively uncongested in the scan at the time, making it a candidate for sacrificing peak throughput in favor of stability, though this still needs to be validated on site.

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

In the common 5 GHz channel-planning scheme discussed here, every increase of 1 in the channel number corresponds to a 5 MHz increase in the center frequency; 20 MHz is a basic channel width, not the only channel width used by Wi-Fi.

To prevent adjacent channels from overlapping in the 5 GHz band, channel numbers must be separated by 4 (for example, 36, 40, 44, and 48; or 149, 153, 157, and 161).

### Bandwidth and Channel Bonding
Common Wi-Fi bandwidths include 20 MHz, 40 MHz, 80 MHz, and 160 MHz.

#### 20 MHz
Taking 802.11ac 20 MHz OFDM as an example, a 64-point FFT is used, with 52 subcarriers carrying data, along with pilot, DC, and guard subcarriers. The configuration varies across Wi-Fi generations and channel bandwidths.

#### 40 MHz / 80 MHz / 160 MHz
Wide channel bandwidth is achieved through channel bonding. Taking 80 MHz as an example, the RF and baseband layers combine four contiguous 20 MHz channels (such as 149, 153, 157, and 161) into a single channel at the underlying layer. Under the corresponding signal-to-noise ratio conditions, a wider bandwidth can provide higher theoretical capacity.

When bonding multiple channels, the router must designate one of them as the primary channel. Beacons and other frames used for discovery and compatibility are typically transmitted over the primary 20 MHz channel, allowing clients to establish a connection accordingly. The exact transmission method still depends on the frame type and protocol mode.

### Shannon’s Theorem

$$C = B \cdot \log_2 \left( 1 + \frac{S}{N + I} \right)$$

- $C$: Maximum channel transmission rate
- $B$: Physical bandwidth
- $S$: Received power of the useful signal
- $N$: Ambient background thermal noise
- $I$: Co-channel interference power

### Thermal Noise Floor Formula

$$N = k \cdot T \cdot B, \qquad N_{\mathrm{dBm}} = 10 \log_{10}\left(\frac{kTB}{1,\mathrm{mW}}\right)$$

- $k$: Boltzmann constant
- $T$: absolute temperature
- $B$: Receive bandwidth
- $N$: thermal noise power within this bandwidth, in watts; use the latter formula when converting to dBm.

Increase in the noise floor as bandwidth grows by a factor:

$$\Delta N = 10 \log_{10}\left(\frac{B_2}{B_1}\right)$$

At the same temperature and reception conditions, integrated thermal noise power increases by approximately $3\text{ dB}$ each time the bandwidth doubles; an actual receiver’s noise figure must also be taken into account.

### Signal-to-Interference-plus-Noise Ratio (SINR)

- **SNR** (signal-to-noise ratio): $\text{SNR} = \frac{S}{N}$
- **SINR** (signal-to-interference-plus-noise ratio): $\text{SINR} = \frac{S}{N + I}$

$$\mathrm{SINR}_{\mathrm{dB}} = 10\log_{10}\left(\frac{S}{N+\sum_i I_i}\right)$$

Power must first be summed in linear units; dBm values from multiple interference sources cannot be added directly. Only when a single co-channel interferer is dominant, thermal noise can be neglected, and both power levels are measured at the same receiving location and over the same bandwidth can the dBm difference between the desired signal and that interferer be used to estimate the SINR approximately. The RSSI values for individual APs listed by scanning tools do not directly provide the SINR during communication.

### QAM Modulation
Binary modulation carries 1 bit per symbol; higher-order modulation uses more distinguishable states to encode more bits in each symbol.

QAM uses in-phase and quadrature components to form a constellation diagram. The receiver recovers the information by distinguishing between constellation points; \(M\)-QAM maps at most \(\log_2 M\) bits per symbol. The effective data rate must also account for channel coding and protocol overhead.

| Modulation Scheme | Number of Bits Mapped to Each Subcarrier Symbol |
| :--- | :--- |
| 1024-QAM | 10 bits |
| 256-QAM | 8 bits |
| 64-QAM | 6 bits |
| 16-QAM | 4 bits |
| QPSK | 2 bits |

The higher the modulation order, the more densely packed the constellation points, and the greater the usual requirements for signal quality and receiver error performance. No universal SINR threshold is specified here: different coding rates, target packet error rates, and device implementations produce different results.