# Cordis: paper and implementation fork

English | [中文](README.zh-CN.md)

This fork supplies Cordis source for the independent [Cordis study](https://github.com/Stool233/cordis-formal-study). Cordis organizes programs through plugins, services, and reversible effects.

## Start here

| Goal | Read |
| --- | --- |
| See the TLC-discovered defects and fixes | [Contributions](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.md) |
| Understand the current paper | [Paper reading](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.md) |
| Locate the checked implementation | [Fork guide](docs/formal-study.md) |
| Run the checks | [Reproduction](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.md) |

The paper is [A Programming Paradigm for Spatiotemporal Composability, arXiv v1](https://arxiv.org/abs/2608.25512v1). The study establishes two cleanup defects through TLC counterexamples, repairs them, and checks the selected fork source. Provider identity remains a supporting regression.

The default branch contains official source and this reading guide. The study's [implementation page](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.md) selects the fixed fork commit. Passing its concrete regression checks does not prove arbitrary plugin effects or the complete paper calculus.

Earlier research is available through the portal's [archive](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.md).
