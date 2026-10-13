import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { PanelFormsService } from './panel-forms.service';
import { PanelStageService } from './panel-stage.service';
import { PanelAdminService } from './panel-admin.service';
import { PanelAuthService } from './panel-auth.service';
import { PanelPortalService } from './panel-portal.service';
import { PanelSelectionService } from './panel-selection.service';
import { PanelAdminController, PanelAuthController, PanelFormsController, PanelPortalController } from './panel.controllers';

// Panel-rated stages (#75-#83): evaluation forms, panelists, the stage lifecycle, the panel
// portal, aggregation and selection.
@Module({
  imports: [MessagingModule],
  controllers: [PanelFormsController, PanelAdminController, PanelAuthController, PanelPortalController],
  providers: [PanelFormsService, PanelStageService, PanelAdminService, PanelAuthService, PanelPortalService, PanelSelectionService],
  exports: [PanelSelectionService, PanelStageService],
})
export class PanelModule {}
