export type CheatSection = {
  title: string;
  items: Array<{
    keys: string;
    description: string;
  }>;
};

export type CheatSheet = {
  slug: string;
  title: string;
  summary: string;
  color: string;
  sections: CheatSection[];
};

export const cheatsheets: CheatSheet[] = [
  {
    slug: "lazyvim",
    title: "LazyVim",
    summary: "Navigation, panes, LSP, and workflow shortcuts.",
    color: "#00d1b2",
    sections: [
      {
        title: "Navigation",
        items: [
          { keys: "h j k l", description: "Move left/down/up/right." },
          { keys: "w / b", description: "Jump to next/previous word." },
          { keys: "gg / G", description: "Go to top/bottom of file." },
          { keys: "Ctrl+h/j/k/l", description: "Move between splits." },
        ],
      },
      {
        title: "Explorer and Search",
        items: [
          { keys: "<leader>e", description: "Toggle Neo-tree." },
          { keys: "<leader>ff", description: "Find files." },
          { keys: "<leader>fg", description: "Live grep in project." },
          { keys: "<leader>fb", description: "List open buffers." },
        ],
      },
      {
        title: "Code",
        items: [
          { keys: "gd / gr", description: "Go to definition / references." },
          { keys: "K", description: "Hover documentation." },
          { keys: "<leader>ca", description: "Code actions." },
          { keys: "<leader>rn", description: "Rename symbol." },
        ],
      },
    ],
  },
  {
    slug: "git",
    title: "Git",
    summary: "High-signal commands for day-to-day branching and review.",
    color: "#ff9f1c",
    sections: [
      {
        title: "Status and History",
        items: [
          { keys: "git status", description: "Inspect current branch and changes." },
          { keys: "git diff", description: "Review unstaged changes." },
          { keys: "git log --oneline", description: "Compact commit history." },
          { keys: "git show <sha>", description: "Display commit details." },
        ],
      },
      {
        title: "Branching",
        items: [
          { keys: "git switch -c <name>", description: "Create and switch branch." },
          { keys: "git switch <name>", description: "Switch to existing branch." },
          { keys: "git branch -d <name>", description: "Delete merged branch." },
          { keys: "git fetch --prune", description: "Update remotes and clean refs." },
        ],
      },
      {
        title: "Staging and Commit",
        items: [
          { keys: "git add -p", description: "Stage selective hunks." },
          { keys: "git commit -m \"...\"", description: "Create commit with message." },
          { keys: "git restore --staged <file>", description: "Unstage file." },
          { keys: "git commit --amend", description: "Edit last commit (careful)." },
        ],
      },
    ],
  },
  {
    slug: "docker",
    title: "Docker",
    summary: "Common image, container, and compose operations.",
    color: "#4cc9f0",
    sections: [
      {
        title: "Containers",
        items: [
          { keys: "docker ps", description: "List running containers." },
          { keys: "docker ps -a", description: "List all containers." },
          { keys: "docker logs -f <id>", description: "Follow container logs." },
          { keys: "docker exec -it <id> sh", description: "Open shell in container." },
        ],
      },
      {
        title: "Images",
        items: [
          { keys: "docker build -t app .", description: "Build image from Dockerfile." },
          { keys: "docker images", description: "List local images." },
          { keys: "docker rmi <image>", description: "Remove image." },
          { keys: "docker image prune", description: "Remove dangling images." },
        ],
      },
      {
        title: "Compose",
        items: [
          { keys: "docker compose up -d", description: "Start services in background." },
          { keys: "docker compose down", description: "Stop and remove services." },
          { keys: "docker compose logs -f", description: "Follow compose logs." },
          { keys: "docker compose exec <svc> sh", description: "Shell into a service." },
        ],
      },
    ],
  },
  {
    slug: "typescript",
    title: "TypeScript",
    summary: "Practical language patterns and utility types.",
    color: "#9381ff",
    sections: [
      {
        title: "Types",
        items: [
          { keys: "type", description: "Compose aliases and unions." },
          { keys: "interface", description: "Describe object shapes." },
          { keys: "keyof / typeof", description: "Derive types from values." },
          { keys: "as const", description: "Freeze literal types." },
        ],
      },
      {
        title: "Utilities",
        items: [
          { keys: "Partial<T>", description: "Make fields optional." },
          { keys: "Required<T>", description: "Make fields required." },
          { keys: "Pick<T, K>", description: "Select specific keys." },
          { keys: "Omit<T, K>", description: "Remove specific keys." },
        ],
      },
      {
        title: "Narrowing",
        items: [
          { keys: "in", description: "Narrow union by property presence." },
          { keys: "instanceof", description: "Narrow by runtime class." },
          { keys: "tagged unions", description: "Use discriminants to branch safely." },
          { keys: "never checks", description: "Enforce exhaustive switches." },
        ],
      },
    ],
  },
];

export function getCheatSheetBySlug(slug: string) {
  return cheatsheets.find((sheet) => sheet.slug === slug);
}
