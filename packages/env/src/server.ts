// Typed stub for the red commit: the fields exist and hold values no test expects.
import { Context, Layer, Option, Redacted } from "effect";

export type DeployProfile = "local" | "hosted";

export type DatabaseConfig =
  | { readonly kind: "pglite"; readonly dataDirectory: string }
  | { readonly kind: "postgres"; readonly url: Redacted.Redacted<string> };

export interface InputLimits {
  readonly bodyMaxBytes: number;
  readonly codeMaxCharacters: Option.Option<number>;
  readonly promptMaxCharacters: Option.Option<number>;
  readonly sampleMaxBytes: number;
  readonly sampleMaxCharacters: Option.Option<number>;
}

export class ServerConfig extends Context.Service<
  ServerConfig,
  {
    readonly database: DatabaseConfig;
    readonly dataDisplayPath: Option.Option<string>;
    readonly host: string;
    readonly limits: InputLimits;
    readonly migrationsPath: string;
    readonly nodeEnv: "development" | "production" | "test";
    readonly port: number;
    readonly profile: DeployProfile;
    readonly webDistPath: string;
  }
>()("@fluenshift/env/ServerConfig") {
  static readonly layer = Layer.succeed(
    ServerConfig,
    ServerConfig.of({
      dataDisplayPath: Option.some(""),
      database: { kind: "postgres", url: Redacted.make("") },
      host: "",
      limits: {
        bodyMaxBytes: Number.NaN,
        codeMaxCharacters: Option.some(Number.NaN),
        promptMaxCharacters: Option.some(Number.NaN),
        sampleMaxBytes: Number.NaN,
        sampleMaxCharacters: Option.some(Number.NaN),
      },
      migrationsPath: "",
      nodeEnv: "test",
      port: Number.NaN,
      profile: "hosted",
      webDistPath: "",
    })
  );
}
