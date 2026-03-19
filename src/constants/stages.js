export const STAGES = Object.freeze({
  INITIAL: "initial",
  INTERESTED: "interested",
  QUALIFIED: "qualified",
  LINK_SENT: "link_sent",
  STALLED: "stalled",
  WIN_BACK: "win_back"
})

export const STAGE_RANK = Object.freeze({
  [STAGES.INITIAL]: 0,
  [STAGES.INTERESTED]: 1,
  [STAGES.QUALIFIED]: 2,
  [STAGES.LINK_SENT]: 3,
  [STAGES.STALLED]: 4,
  [STAGES.WIN_BACK]: 5
})
