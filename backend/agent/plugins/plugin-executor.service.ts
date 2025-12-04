import { Injectable, Logger } from "@nestjs/common";
import * as vm from "vm";
import { AuthContextData } from "../../context/auth-context.interface";
import { PluginRuntime } from "./plugin-runtime";

@Injectable()
export class PluginExecutorService {
  private readonly logger = new Logger(PluginExecutorService.name);
  private readonly timeout = 5000; // 5 second timeout
  private readonly maxMemory = 50 * 1024 * 1024; // 50MB memory limit

  async execute(code: string, args: any, ctx: AuthContextData): Promise<any> {
    this.logger.log(`Executing plugin tool with args: ${JSON.stringify(args)}`);

    try {
      // Create isolated context with only safe globals
      const sandbox = {
        args,
        ctx: {
          userId: ctx.userId,
          workspaceId: ctx.workspaceId,
          role: ctx.membership.role,
        },
        runtime: PluginRuntime,
        console: {
          log: (...args: any[]) => this.logger.debug(`[Plugin]`, ...args),
          error: (...args: any[]) => this.logger.error(`[Plugin]`, ...args),
          warn: (...args: any[]) => this.logger.warn(`[Plugin]`, ...args),
        },
        // Safe globals
        JSON,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Promise,
        setTimeout: undefined, // Disabled
        setInterval: undefined, // Disabled
        setImmediate: undefined, // Disabled
        process: undefined, // Disabled
        require: undefined, // Disabled
        module: undefined, // Disabled
        exports: undefined, // Disabled
        __dirname: undefined, // Disabled
        __filename: undefined, // Disabled
        global: undefined, // Disabled
      };

      // Create VM context
      const context = vm.createContext(sandbox);

      // Wrap code in async function
      const wrappedCode = `
        (async function() {
          const execute = async function(args, ctx, runtime) {
            ${code}
          };
          return await execute(args, ctx, runtime);
        })();
      `;

      // Execute with timeout
      const result = await this.executeWithTimeout(wrappedCode, context);

      this.logger.log(`Plugin tool execution completed successfully`);
      return result;
    } catch (error: any) {
      this.logger.error(
        `Error executing plugin tool: ${error.message}`,
        error.stack
      );
      throw new Error(`Plugin execution failed: ${error.message}`);
    }
  }

  private async executeWithTimeout(
    code: string,
    context: vm.Context
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Plugin execution timeout (5 seconds exceeded)"));
      }, this.timeout);

      try {
        // Run script in sandbox
        const script = new vm.Script(code, {
          filename: "plugin-tool.js",
        });

        const result = script.runInContext(context, {
          timeout: this.timeout,
          breakOnSigint: true,
        });

        // Handle promise results
        if (result && typeof result.then === "function") {
          result
            .then((value: any) => {
              clearTimeout(timeoutId);
              resolve(value);
            })
            .catch((error: any) => {
              clearTimeout(timeoutId);
              reject(error);
            });
        } else {
          clearTimeout(timeoutId);
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }
}
