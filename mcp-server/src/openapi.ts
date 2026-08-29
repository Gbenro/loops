/**
 * OpenAPI 3.1.0 Specification for Luna Loop Assist (ChatGPT GPT Actions)
 * Auto-generated and audited from production Luna MCP Tools & REST Endpoints.
 * 
 * Target Server: https://loops-app-production.up.railway.app
 * Authentication: Bearer <Supabase JWT or API Key>
 */

export const LUNA_OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Luna Loop Assist API",
    description: "Production API for Luna Loops: Continuous Reflection, Lunar Grounding, Loops, Echoes, Threads, and Co-Created Reflections.",
    version: "1.0.0"
  },
  servers: [
    {
      url: "https://loops-app-production.up.railway.app",
      description: "Railway Production"
    }
  ],
  paths: {
    "/api/lunar/current": {
      get: {
        operationId: "get_lunar_context",
        summary: "Get Current Lunar Context",
        description: "Returns the current live lunar phase, illumination percentage, cycle day (1-29), zodiac sign, and threshold/flow state.",
        responses: {
          "200": {
            description: "Current lunar telemetry and phase data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    phase: { type: "object" },
                    illumination: { type: "number" },
                    dayOfCycle: { type: "integer" },
                    zodiac: { type: "object" },
                    lunarMonth: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/search": {
      get: {
        operationId: "search_luna",
        summary: "Unified Search Across Luna",
        description: "Search across all user records (echoes, loops, rhythms, reflections) using text or keyword matching.",
        parameters: [
          {
            name: "query",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Search term or concept"
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 10 },
            description: "Maximum records to return"
          }
        ],
        responses: {
          "200": {
            description: "List of matching echoes, loops, and reflections",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/echoes": {
      get: {
        operationId: "search_echoes",
        summary: "Search & Filter User Echoes",
        description: "Search and filter personal Echoes by lunar phase, tags, date range, or text.",
        parameters: [
          {
            name: "query",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Search query"
          },
          {
            name: "phase",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Lunar phase filter (e.g. new, full, waxing-crescent)"
          },
          {
            name: "tags",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Comma-separated list of tags"
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 20 },
            description: "Maximum results"
          }
        ],
        responses: {
          "200": {
            description: "Matching Echoes list",
            content: { "application/json": { schema: { type: "array" } } }
          }
        }
      },
      post: {
        operationId: "create_echo",
        summary: "Create Personal Echo (User Observation)",
        description: "Create a direct personal user observation. Server enforces provenance: author=user, kind=original_echo. Automatically stamps current lunar metadata.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: { type: "string", description: "Content of the user's observation" },
                  source: { type: "string", default: "chatgpt", description: "Origin client" },
                  tags: { type: "array", items: { type: "string" }, description: "Emotional or thematic tags" },
                  loopIds: { type: "array", items: { type: "string" }, description: "Associated loop IDs" },
                  energyState: { type: "string", description: "Energy state (e.g. resting, focused)" },
                  metadata: { type: "object", description: "Optional metadata" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Created Echo record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/reflections/conversation": {
      post: {
        operationId: "create_conversation_reflection",
        summary: "Create Conversation Reflection (Co-Created Insight)",
        description: "Save an insight or reflection derived from dialogue with the user. Server enforces provenance: author=co-created, kind=conversation_reflection, source=luna_conversation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: { type: "string", description: "Content of the reflection/insight" },
                  sessionId: { type: "string", description: "Chat session ID" },
                  conversationTitle: { type: "string", description: "Topic of conversation" },
                  tags: { type: "array", items: { type: "string" }, description: "Tags (e.g. ['conversation-reflection'])" },
                  loopIds: { type: "array", items: { type: "string" }, description: "Associated loop IDs" },
                  energyState: { type: "string", description: "Energy signature" },
                  metadata: { type: "object", description: "Optional custom metadata" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Created Conversation Reflection record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/echoes/{id}": {
      get: {
        operationId: "get_echo",
        summary: "Get Echo by ID",
        description: "Retrieve a specific Echo by its unique stable ID (e.g. 'e178802...').",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Echo unique ID"
          }
        ],
        responses: {
          "200": {
            description: "Echo details",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      },
      patch: {
        operationId: "update_echo",
        summary: "Update Echo Metadata / Tags",
        description: "Update tags, loop associations, or status of an existing Echo. Text content and lunar context are strictly immutable.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Echo unique ID"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  tags: { type: "array", items: { type: "string" }, description: "Updated list of tags" },
                  status: { type: "string", enum: ["active", "archived"], description: "Echo status" },
                  loopIds: { type: "array", items: { type: "string" }, description: "Updated loop associations" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated Echo record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/echoes/{id}/archive": {
      post: {
        operationId: "archive_echo",
        summary: "Archive Echo",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Echo ID to archive"
          }
        ],
        responses: {
          "200": {
            description: "Archived Echo record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/echoes/{id}/restore": {
      post: {
        operationId: "restore_echo",
        summary: "Restore Archived Echo",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Echo ID to restore"
          }
        ],
        responses: {
          "200": {
            description: "Restored Echo record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/echoes/{id}/reflections": {
      get: {
        operationId: "get_echo_reflections",
        summary: "Get Reflections Attached to an Echo",
        description: "List all AI reflections or conversation insights attached to a specific user Echo.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Target Echo ID"
          }
        ],
        responses: {
          "200": {
            description: "List of attached reflections",
            content: { "application/json": { schema: { type: "array" } } }
          }
        }
      },
      post: {
        operationId: "attach_reflection",
        summary: "Attach AI Reflection to an Echo",
        description: "Attaches an AI reflection to an existing Echo without mutating the original Echo content.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Target Echo ID"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string", description: "Reflection text content" },
                  tags: { type: "array", items: { type: "string" } },
                  metadata: { type: "object" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Created reflection record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/loops": {
      get: {
        operationId: "list_loops",
        summary: "List Loops",
        description: "List user loops filtered by status (active, completed, archived), lunar phase, or scope.",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["active", "completed", "archived", "all"], default: "active" },
            description: "Loop status filter"
          },
          {
            name: "scope",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["cycle", "phase", "micro"], default: "cycle" },
            description: "Loop temporal scope"
          },
          {
            name: "phase",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter by target lunar phase"
          }
        ],
        responses: {
          "200": {
            description: "List of loops",
            content: { "application/json": { schema: { type: "array" } } }
          }
        }
      },
      post: {
        operationId: "create_loop",
        summary: "Create a Loop",
        description: "Create a new intention loop tied to a lunar cycle or phase with optional subtasks.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string", description: "Loop title/intention" },
                  description: { type: "string", description: "Detailed description" },
                  scope: { type: "string", enum: ["cycle", "phase", "micro"], default: "cycle" },
                  targetPhase: { type: "string", description: "Target phase (e.g. 'full')" },
                  subtasks: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["title"],
                      properties: {
                        title: { type: "string" },
                        completed: { type: "boolean", default: false }
                      }
                    }
                  },
                  tags: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Created loop record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/loops/{id}": {
      get: {
        operationId: "get_loop",
        summary: "Get Loop Details",
        description: "Get full details of a loop, including subtasks, connected echoes, and completion state.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Loop ID (e.g. 'l1788...')"
          }
        ],
        responses: {
          "200": {
            description: "Loop details",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      },
      patch: {
        operationId: "update_loop",
        summary: "Update Loop",
        description: "Update title, description, subtasks, or tags for an active loop.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Loop ID"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  subtasks: { type: "array", items: { type: "object" } },
                  tags: { type: "array", items: { type: "string" } },
                  status: { type: "string", enum: ["active", "completed", "archived"] }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated loop record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/loops/{id}/close": {
      post: {
        operationId: "close_loop",
        summary: "Close/Complete Loop",
        description: "Mark a loop as completed with an optional reflection closing note.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Loop ID to close"
          }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  note: { type: "string", description: "Closing reflection note" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Closed loop record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/loops/{id}/carry-forward": {
      post: {
        operationId: "carry_loop_forward",
        summary: "Carry Loop Forward into New Cycle",
        description: "Carry an active or incomplete loop into the current lunar cycle.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Loop ID to carry forward"
          }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  new_note: { type: "string", description: "Context note for carrying forward" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "New carried forward loop record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/threads": {
      get: {
        operationId: "list_threads",
        summary: "List Thematic Threads",
        description: "List longitudinal threads that weave multiple echoes and loops together.",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["active", "archived", "all"], default: "active" }
          }
        ],
        responses: {
          "200": {
            description: "List of threads",
            content: { "application/json": { schema: { type: "array" } } }
          }
        }
      },
      post: {
        operationId: "create_thread",
        summary: "Create a Thematic Thread",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  theme: { type: "string" },
                  tags: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Created thread record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/threads/{id}": {
      get: {
        operationId: "get_thread",
        summary: "Get Thread Details",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Thread details with connected items",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      },
      patch: {
        operationId: "update_thread",
        summary: "Update Thread",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  status: { type: "string", enum: ["active", "archived"] }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Updated thread record",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/threads/{id}/echoes/{echoId}": {
      post: {
        operationId: "connect_echo_to_thread",
        summary: "Connect Echo to Thread",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Thread ID"
          },
          {
            name: "echoId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Echo ID to connect"
          }
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  relationshipType: { type: "string" },
                  note: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Connection confirmed",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      },
      delete: {
        operationId: "disconnect_echo_from_thread",
        summary: "Disconnect Echo from Thread",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Thread ID"
          },
          {
            name: "echoId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Echo ID to disconnect"
          }
        ],
        responses: {
          "200": {
            description: "Disconnection confirmed",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/chat/inference-summary": {
      get: {
        operationId: "get_inference_summary",
        summary: "Get Inference Usage & Cost Summary",
        description: "Aggregate tokens, voice seconds, and costs across sessions and dates.",
        parameters: [
          {
            name: "sessionId",
            in: "query",
            required: false,
            schema: { type: "string" }
          },
          {
            name: "date",
            in: "query",
            required: false,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Aggregated inference receipts",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Provide your Supabase access token (or anon/service key) in the Authorization header: 'Bearer <token>'"
      }
    }
  },
  security: [
    {
      BearerAuth: []
    }
  ]
};
