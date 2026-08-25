import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a staff account' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List staff accounts' })
  findAll(@Query('role') role?: string) {
    return this.usersService.findAll(role);
  }

  @Get('doctors')
  @ApiOperation({ summary: 'Doctors available for appointment assignment' })
  listDoctors() {
    return this.usersService.listDoctors();
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get a staff account' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a staff account' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deactivate a staff account' })
  deactivate(@Param('id') id: string, @CurrentUser('id') requesterId: string) {
    return this.usersService.deactivate(id, requesterId);
  }
}
