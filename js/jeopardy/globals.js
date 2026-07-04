const DEFAULT_GAME_KEY = "pokemon";
const MIN_TEAM_COUNT = 1;
const MAX_TEAM_COUNT = 6;
const GAME_BUILDER_STORAGE_KEY = "reveal-jeopardy-builder-draft";

let availableGames = [];
let adminState = { authenticated: false };
let gameKey = DEFAULT_GAME_KEY;
let gameConfig = null;
let categories = [];
let defaultTeamNames = [];
let teamIds = [];
let teams = [];
let scores = {};
let usedQuestions = [];
let questionAwards = {};
let questionIdSet = new Set();
let gameBuilderDraft = null;
let builderSelectedCategoryIndex = 0;
let builderSelectedQuestionIndex = 0;
let allowQuestionBoardNavigation = false;

const KEY_CODE_TO_KEY = {
	37: "ArrowLeft",
	38: "ArrowUp",
	39: "ArrowRight",
	40: "ArrowDown",
};
