import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CourseRole, CurrentRequest, DefaultGuard, RequiredRoles, Role, RoleGuard } from '../auth';
import { CourseGuard } from '../auth/course.guard';
import { CourseAccessService } from './course-access.service';
import { CoursesService } from './courses.service';
import { CourseDto, LeaveCourseRequestDto, UpdateCourseDto } from './dto';
import { CopyCourseDto } from './dto/copy-course.dto';
import { CourseScheduleService } from './course-schedule/course-schedule.service';

@Controller('courses')
@ApiTags('courses schedule')
export class CoursesController {
  constructor(
    private courseService: CoursesService,
    private courseAccessService: CourseAccessService,
    private courseScheduleService: CourseScheduleService,
  ) {}

  @Get('/')
  @ApiOperation({ operationId: 'getCourses' })
  @ApiOkResponse({ type: [CourseDto] })
  @UseGuards(DefaultGuard)
  public async getCourses() {
    const data = await this.courseService.getAll();
    return data.map(it => new CourseDto(it));
  }

  @Get('/:courseId')
  @ApiOperation({ operationId: 'getCourse' })
  @ApiForbiddenResponse()
  @ApiOkResponse({ type: CourseDto })
  @UseGuards(DefaultGuard, CourseGuard)
  public async getCourse(@Req() _: CurrentRequest, @Param('courseId', ParseIntPipe) courseId: number) {
    const data = await this.courseService.getById(courseId);
    return new CourseDto(data);
  }

  @Put('/:courseId')
  @ApiOperation({ operationId: 'updateCourse' })
  @ApiForbiddenResponse()
  @ApiOkResponse({ type: CourseDto })
  @UseGuards(DefaultGuard, RoleGuard)
  @RequiredRoles([CourseRole.Manager, Role.Admin])
  public async updateCourse(
    @Req() req: CurrentRequest,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() update: UpdateCourseDto,
  ) {
    if (!this.courseAccessService.canAccessCourseAsManager(req.user, courseId)) {
      throw new ForbiddenException('No access to edit course');
    }
    const data = await this.courseService.update(courseId, update);
    return new CourseDto(data);
  }

  @Post('/:courseId/leave')
  @ApiOperation({ operationId: 'leaveCourse' })
  @ApiBody({ type: LeaveCourseRequestDto, required: false })
  @UseGuards(DefaultGuard, RoleGuard)
  @RequiredRoles([CourseRole.Student])
  public async leaveCourse(
    @Req() req: CurrentRequest,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body('comment') comment?: string,
  ) {
    const studentId = req.user.courses[courseId]?.studentId;
    if (studentId) {
      await this.courseAccessService.leaveAsStudent(courseId, studentId, comment);
    }
  }

  @Post('/:courseId/rejoin')
  @ApiOperation({ operationId: 'rejoinCourse' })
  @UseGuards(DefaultGuard, RoleGuard)
  @RequiredRoles([CourseRole.Student])
  public async rejoinCourse(@Req() req: CurrentRequest, @Param('courseId', ParseIntPipe) courseId: number) {
    const studentId = req.user.courses[courseId]?.studentId;
    if (studentId) {
      await this.courseAccessService.rejoinAsStudent(courseId, studentId);
    }
  }

  @Post('/:courseId/copy')
  @ApiOkResponse({})
  @ApiOperation({ operationId: 'copyCourse' })
  @ApiBody({ type: CopyCourseDto, required: true })
  @UseGuards(DefaultGuard, RoleGuard)
  @RequiredRoles([CourseRole.Manager, Role.Admin])
  public async copyscheduleCourse(@Req() req: CurrentRequest, @Param('courseId') courseId: number) {
    const created = await this.courseService.create(req.body);
    if (created.id) {
      await this.courseScheduleService.copyFromTo(courseId, created.id);
    }
    return await this.courseService.getById(created.id);
  }
}
