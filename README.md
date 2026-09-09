# Cordis: paper and implementation fork

English | [中文](README.zh-CN.md)

This fork supplies Cordis source for the independent [Cordis study](https://github.com/Stool233/cordis-formal-study). Cordis organizes programs through plugins, services, and reversible effects.

## Start here

| Goal | Read |
| --- | --- |
| Understand the current paper | [Paper reading](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.md) |
| Locate the checked implementation | [Fork guide](docs/formal-study.md) |
| Understand the confirmed behavior checks | [Verification](https://github.com/Stool233/cordis-formal-study/blob/main/docs/verification.md) |
| Run the checks | [Reproduction](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.md) |

The paper is [A Programming Paradigm for Spatiotemporal Composability, arXiv v1](https://arxiv.org/abs/2608.25512v1). The study checks dependency cleanup order, consumer discoverability during retirement, and replacement-provider identity on pinned fork source.

The default branch contains official source and this reading guide. The study's [implementation page](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.md) selects the fixed fork commit. Passing its concrete regression checks does not prove arbitrary plugin effects or the complete paper calculus.

Earlier research is available through the portal's [archive](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.md).
