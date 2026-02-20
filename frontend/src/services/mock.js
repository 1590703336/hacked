// MOCK SERVICE LAYER
// Swap USE_MOCK to false in index.js when backend is ready

export const ocr = {
  process: async (imageBase64) => {
    await delay(1200);
    return {
      success: true,
      data: {
        markdown: MOCK_CONTENT,
        provider: "gemini"
      }
    };
  }
};

export const summarizer = {
  summarize: async (text) => {
    await delay(1500);
    return {
      success: true,
      data: {
        takeaways: [
          "The central limit theorem states that sample means approach a normal distribution as sample size grows, regardless of the original population distribution.",
          "Statistical significance (p < 0.05) does not imply practical significance — always report effect sizes alongside p-values.",
          "ANOVA compares variance between groups versus within groups to determine if group means differ significantly."
        ],
        tokensUsed: 312
      }
    };
  }
};

export const tts = {
  synthesize: async (text, voice = "nova") => {
    await delay(800);
    return { success: true, data: { audioUrl: null, chunks: MOCK_CHUNKS } };
  },
  chunk: async (markdown) => {
    await delay(500);
    return { success: true, data: { chunks: MOCK_CHUNKS } };
  }
};

export const tutor = {
  ask: async (question, context = "") => {
    await delay(2000);
    const responses = {
      default: "Think of it like comparing apples from three different farms. ANOVA helps you figure out if the differences in sweetness you observe are due to the farm (real effect) or just natural variation between individual apples (random chance).",
      pvalue: "A p-value is the probability of seeing your results — or more extreme results — if there was actually no real effect. A p-value of 0.03 means there's only a 3% chance your results are due to random luck.",
      variance: "Variance measures how spread out your data is from the average. High variance means your data points are scattered far from the mean; low variance means they cluster tightly around it."
    };
    const key = question.toLowerCase().includes("p-value") ? "pvalue"
      : question.toLowerCase().includes("variance") ? "variance" : "default";
    return {
      success: true,
      data: { question, answer: responses[key], tokensUsed: 187 }
    };
  },
  transcribe: async (audioBlob) => {
    await delay(1000);
    return { success: true, data: { text: "What does p-value mean in this context?" } };
  }
};

export const capture = {
  upload: async (file) => {
    await delay(1000);
    return {
      success: true,
      data: { filename: file.name, mimetype: file.type, size: file.size, text: MOCK_CONTENT }
    };
  },
  screen: async (imageBase64) => {
    await delay(600);
    return { success: true, data: { capturedAt: new Date().toISOString(), imageSize: "1920x1080" } };
  }
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const MOCK_CAPTURES = [
  { id: 1, title: "Statistics Lecture — ANOVA & Hypothesis Testing", timestamp: "2 mins ago", type: "pdf", preview: "The analysis of variance (ANOVA) is a statistical method used to test differences between two or more means..." },
  { id: 2, title: "Calculus Notes — Partial Derivatives", timestamp: "1 hour ago", type: "image", preview: "Given f(x,y) = x²y + sin(y), the partial derivative with respect to x is..." },
  { id: 3, title: "CS Algorithms — Dynamic Programming", timestamp: "Yesterday", type: "pdf", preview: "Dynamic programming is both a mathematical optimization method and a computer programming method..." }
];

export const MOCK_CHUNKS = [
  "The analysis of variance, commonly known as ANOVA, is a statistical method used to test differences between two or more group means.",
  "It works by comparing the variance between groups to the variance within groups.",
  "When the between-group variance is significantly larger than the within-group variance, we conclude that at least one group mean is different.",
  "The F-statistic is the ratio of between-group variance to within-group variance.",
  "A large F-statistic indicates that group means differ more than we would expect by chance alone."
];

export const MOCK_CONTENT = `## Analysis of Variance (ANOVA)

The analysis of variance, commonly known as **ANOVA**, is a statistical method used to test differences between two or more group means. It works by comparing the variance between groups to the variance within groups.

### The F-Statistic

The core of ANOVA is the F-statistic, defined as:

$$F = \\frac{\\text{Between-group variance}}{\\text{Within-group variance}}$$

When the between-group variance is significantly larger, we conclude that at least one group mean differs from the others.

### Assumptions

1. **Independence**: Observations must be independent of each other
2. **Normality**: The residuals should be approximately normally distributed  
3. **Homoscedasticity**: Variance should be roughly equal across groups

### Interpreting p-values

A p-value below 0.05 indicates statistical significance, but remember: **statistical significance ≠ practical significance**. Always report effect sizes such as Cohen's f or η² alongside your p-values.`;

export const MOCK_CHAT_HISTORY = [
  { id: 1, role: "user", text: "I don't understand what ANOVA means in this context." },
  { id: 2, role: "ai", text: "Think of it like comparing sweetness levels of apples from three different farms. ANOVA helps you figure out if the differences you observe are due to the farm itself — a real effect — or just natural variation between individual apples, which is random chance. The F-statistic is essentially the ratio of 'how different are the farms' to 'how different are apples on the same farm'." },
  { id: 3, role: "user", text: "What is a p-value then?" },
  { id: 4, role: "ai", text: "A p-value is the probability of seeing your results — or more extreme ones — if there was actually no real effect at all. A p-value of 0.03 means there's only a 3% chance your results occurred purely by random luck. That's why we use 0.05 as a threshold: we're accepting a 5% risk of being wrong when we say something is 'significant'." }
];
