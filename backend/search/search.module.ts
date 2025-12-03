import { Module, Global } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OpenAIModule } from "../openai/openai.module";
import { SearchIndexService } from "./search-index.service";
import { SearchController } from "./search.controller";

@Global()
@Module({
  imports: [PrismaModule, OpenAIModule],
  providers: [SearchIndexService],
  controllers: [SearchController],
  exports: [SearchIndexService],
})
export class SearchModule {}
