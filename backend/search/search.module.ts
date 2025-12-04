import { Module, Global } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OpenAIModule } from "../openai/openai.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { SearchIndexService } from "./search-index.service";
import { SearchController } from "./search.controller";

@Global()
@Module({
  imports: [PrismaModule, OpenAIModule, RateLimitModule],
  providers: [SearchIndexService],
  controllers: [SearchController],
  exports: [SearchIndexService],
})
export class SearchModule {}
